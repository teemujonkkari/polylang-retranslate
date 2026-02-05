<?php
/**
 * REST API endpoint for re-translating posts.
 *
 * @package WP_Syntex\Polylang_Retranslate
 * @since 1.0.0
 */

namespace WP_Syntex\Polylang_Retranslate;

defined( 'ABSPATH' ) || exit;

use PLL_Base;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;
use PLL_Export_Container;
use PLL_Export_Data_From_Posts;
use WP_Syntex\Polylang_Pro\Modules\Machine_Translation\Processor;
use WP_Syntex\Polylang_Pro\Modules\Machine_Translation\Data;
use WP_Syntex\Polylang_Pro\Modules\Machine_Translation\Services\Service_Interface;

/**
 * REST API endpoint class for re-translating posts.
 *
 * Handles the REST API endpoint that processes re-translation requests
 * using Polylang Pro's machine translation infrastructure.
 *
 * @since 1.0.0
 */
class REST_Endpoint {

	/**
	 * REST API namespace.
	 *
	 * @since 1.0.0
	 * @var string
	 */
	const NAMESPACE = 'pll-retranslate/v1';

	/**
	 * Polylang instance.
	 *
	 * @since 1.0.0
	 * @var PLL_Base
	 */
	private $polylang;

	/**
	 * Active machine translation service.
	 *
	 * @since 1.0.0
	 * @var Service_Interface
	 */
	private $service;

	/**
	 * Constructor.
	 *
	 * @since 1.0.0
	 *
	 * @param PLL_Base          $polylang The Polylang instance.
	 * @param Service_Interface $service  The active machine translation service.
	 */
	public function __construct( PLL_Base $polylang, Service_Interface $service ) {
		$this->polylang = $polylang;
		$this->service  = $service;
	}

	/**
	 * Registers the REST API routes.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function register(): void {
		register_rest_route(
			self::NAMESPACE,
			'/translate',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'translate' ),
				'permission_callback' => array( $this, 'permission_check' ),
				'args'                => array(
					'source_post_id'  => array(
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
						'description'       => __( 'The ID of the source post to translate from.', 'polylang-retranslate' ),
					),
					'target_language' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
						'description'       => __( 'The target language slug.', 'polylang-retranslate' ),
					),
				),
			)
		);
	}

	/**
	 * Checks if the current user has permission to perform the translation.
	 *
	 * Verifies that the user can edit both the source post and the existing
	 * translation post. Does not allow creating new translations.
	 * Stores validated data in request attributes to avoid duplicate queries.
	 *
	 * @since 1.0.0
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return bool|WP_Error True if the user has permission, WP_Error otherwise.
	 */
	public function permission_check( WP_REST_Request $request ) {
		$source_id   = absint( $request->get_param( 'source_post_id' ) );
		$target_lang = sanitize_key( $request->get_param( 'target_language' ) );

		// Check if user can edit the source post.
		if ( ! current_user_can( 'edit_post', $source_id ) ) {
			return new WP_Error(
				'rest_forbidden',
				__( 'You do not have permission to edit the source post.', 'polylang-retranslate' ),
				array( 'status' => 403 )
			);
		}

		// Get and cache the source post to avoid duplicate query in translate().
		$source_post = get_post( $source_id );
		if ( ! $source_post ) {
			return new WP_Error(
				'rest_forbidden',
				__( 'Source post not found.', 'polylang-retranslate' ),
				array( 'status' => 404 )
			);
		}
		$request->set_param( '_source_post', $source_post );

		// Get and cache the target language object.
		$target_language = \PLL()->model->get_language( $target_lang );
		if ( ! $target_language ) {
			return new WP_Error(
				'rest_forbidden',
				__( 'Invalid target language.', 'polylang-retranslate' ),
				array( 'status' => 400 )
			);
		}
		$request->set_param( '_target_language', $target_language );

		// Get the translation post ID and cache it.
		$tr_id = \PLL()->model->post->get_translation( $source_id, $target_language );

		if ( ! $tr_id ) {
			return new WP_Error(
				'rest_forbidden',
				__( 'No existing translation found. This plugin only re-translates existing translations.', 'polylang-retranslate' ),
				array( 'status' => 403 )
			);
		}
		$request->set_param( '_translation_id', $tr_id );

		// Check if user can edit the translation post.
		if ( ! current_user_can( 'edit_post', $tr_id ) ) {
			return new WP_Error(
				'rest_forbidden',
				__( 'You do not have permission to edit the translation post.', 'polylang-retranslate' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}

	/**
	 * Handles the translation request.
	 *
	 * Exports the source post content, translates it using DeepL,
	 * and updates the existing translation post.
	 *
	 * @since 1.0.0
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response|WP_Error The response or error.
	 */
	public function translate( WP_REST_Request $request ) {
		// Get cached values from permission_check to avoid duplicate DB queries.
		$source_post     = $request->get_param( '_source_post' );
		$target_language = $request->get_param( '_target_language' );
		$tr_id           = $request->get_param( '_translation_id' );

		// Check if post type supports translations.
		if ( ! \pll_is_translated_post_type( $source_post->post_type ) ) {
			$this->log( sprintf(
				'Translation rejected: post type "%s" not translatable (post ID: %d)',
				$source_post->post_type,
				$source_post->ID
			) );
			return new WP_Error(
				'invalid_post_type',
				__( 'This post type does not support translations.', 'polylang-retranslate' ),
				array( 'status' => 400 )
			);
		}

		$user_id = get_current_user_id();
		$this->log( sprintf(
			'Re-translation started: user #%d, source post #%d ("%s") -> %s (target post #%d)',
			$user_id,
			$source_post->ID,
			$source_post->post_title,
			$target_language->slug,
			$tr_id
		) );

		// Create the processor using the already validated service from constructor.
		$processor = new Processor( \PLL(), $this->service->get_client() );

		// Create export container and exporter.
		$container = new PLL_Export_Container( Data::class );
		$exporter  = new PLL_Export_Data_From_Posts( \PLL()->model );

		// Export the source post content for translation.
		// The 'include_translated_items' option is critical - without it,
		// posts that already have a translation would be skipped.
		$exporter->send_to_export(
			$container,
			array( $source_post ),
			$target_language,
			array( 'include_translated_items' => true )
		);

		// Translate the content using the machine translation service.
		$translate_result = $processor->translate( $container );

		if ( $translate_result->has_errors() ) {
			$this->log( sprintf(
				'Re-translation failed: post #%d -> %s, error: %s',
				$source_post->ID,
				$target_language->slug,
				$translate_result->get_error_message()
			) );
			return new WP_Error(
				'translation_failed',
				sprintf(
					/* translators: %s: error message */
					__( 'Translation failed: %s', 'polylang-retranslate' ),
					$translate_result->get_error_message()
				),
				array( 'status' => 500 )
			);
		}

		// Save the translated content to the existing translation post.
		// This calls PLL_Translation_Post_Model::update_post_translation()
		// which preserves the post_status.
		$save_result = $processor->save( $container );

		if ( $save_result->has_errors() ) {
			$this->log( sprintf(
				'Re-translation save failed: post #%d -> %s, error: %s',
				$source_post->ID,
				$target_language->slug,
				$save_result->get_error_message()
			) );
			return new WP_Error(
				'save_failed',
				sprintf(
					/* translators: %s: error message */
					__( 'Failed to save translation: %s', 'polylang-retranslate' ),
					$save_result->get_error_message()
				),
				array( 'status' => 500 )
			);
		}

		$this->log( sprintf(
			'Re-translation completed: post #%d -> %s (post #%d) by user #%d',
			$source_post->ID,
			$target_language->slug,
			$tr_id,
			$user_id
		) );

		// Return success response.
		return rest_ensure_response(
			array(
				'success'    => true,
				'post_id'    => $tr_id,
				'post_title' => get_the_title( $tr_id ),
			)
		);
	}

	/**
	 * Logs a message to the debug log if WP_DEBUG is enabled.
	 *
	 * @since 1.0.0
	 *
	 * @param string $message The message to log.
	 * @return void
	 */
	private function log( string $message ): void {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[Polylang Re-translate] ' . $message ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		}
	}
}
