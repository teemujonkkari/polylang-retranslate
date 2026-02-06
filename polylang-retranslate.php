<?php
/**
 * Plugin Name: Polylang Re-translate
 * Plugin URI: https://github.com/teemujonkkari/polylang-retranslate
 * Description: Re-translate existing translations using DeepL directly from the block editor. Requires Polylang Pro with Machine Translation enabled.
 * Version: 1.1.1
 * Author: Teemu Jonkkari
 * Author URI: https://github.com/teemujonkkari
 * License: GPL-3.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: polylang-retranslate
 * Domain Path: /languages
 * Requires at least: 6.2
 * Requires PHP: 7.2
 *
 * @package WP_Syntex\Polylang_Retranslate
 */

defined( 'ABSPATH' ) || exit;

/**
 * Plugin constants.
 */
define( 'PLL_RETRANSLATE_VERSION', '1.1.1' );
define( 'PLL_RETRANSLATE_FILE', __FILE__ );
define( 'PLL_RETRANSLATE_DIR', plugin_dir_path( __FILE__ ) );
define( 'PLL_RETRANSLATE_URL', plugin_dir_url( __FILE__ ) );

/**
 * Main plugin class.
 *
 * Handles plugin initialization, dependency checks, and hook registration.
 *
 * @since 1.0.0
 */
class PLL_Retranslate {

	/**
	 * Polylang instance.
	 *
	 * @since 1.0.0
	 * @var object|null
	 */
	private $polylang = null;

	/**
	 * Active machine translation service.
	 *
	 * @since 1.0.0
	 * @var object|null
	 */
	private $service = null;

	/**
	 * Singleton instance.
	 *
	 * @since 1.0.0
	 * @var PLL_Retranslate|null
	 */
	private static $instance = null;

	/**
	 * Gets the singleton instance.
	 *
	 * @since 1.0.0
	 *
	 * @return PLL_Retranslate
	 */
	public static function instance(): PLL_Retranslate {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 *
	 * @since 1.0.0
	 */
	private function __construct() {
		// Load translations.
		add_action( 'init', array( $this, 'load_textdomain' ) );

		// Check for Polylang Pro dependency.
		if ( ! defined( 'POLYLANG_PRO' ) ) {
			add_action( 'admin_notices', array( $this, 'admin_notice_missing_dependency' ) );
			return;
		}

		// Initialize after Polylang Pro is fully loaded (priority 20, after Pro modules at 0).
		add_action( 'pll_init', array( $this, 'init' ), 20 );
	}

	/**
	 * Loads the plugin text domain for translations.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function load_textdomain(): void {
		load_plugin_textdomain(
			'polylang-retranslate',
			false,
			dirname( plugin_basename( PLL_RETRANSLATE_FILE ) ) . '/languages'
		);
	}

	/**
	 * Displays admin notice when Polylang Pro is not active.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function admin_notice_missing_dependency(): void {
		?>
		<div class="notice notice-error">
			<p>
				<strong><?php esc_html_e( 'Polylang Re-translate', 'polylang-retranslate' ); ?></strong>:
				<?php
				printf(
					/* translators: %s: Polylang Pro link */
					esc_html__( 'This plugin requires %s to be installed and activated with Machine Translation enabled.', 'polylang-retranslate' ),
					'<a href="https://polylang.pro/" target="_blank" rel="noopener noreferrer">Polylang Pro</a>'
				);
				?>
			</p>
		</div>
		<?php
	}

	/**
	 * Initializes the plugin after Polylang is ready.
	 *
	 * @since 1.0.0
	 *
	 * @param object $polylang The Polylang instance.
	 * @return void
	 */
	public function init( $polylang ): void {
		$this->polylang = $polylang;

		// Check if machine translation is enabled.
		if ( empty( $polylang->options['machine_translation_enabled'] ) ) {
			return;
		}

		// Check for active translation service.
		$factory = new WP_Syntex\Polylang_Pro\Modules\Machine_Translation\Factory( $polylang->model );
		$service = $factory->get_active_service();

		if ( ! $service || ! $service->is_active() ) {
			return;
		}

		$this->service = $service;

		// Register REST endpoint.
		add_action( 'rest_api_init', array( $this, 'register_rest_endpoint' ) );

		// Enqueue block editor scripts.
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_editor_assets' ), 20 );
	}

	/**
	 * Registers the REST API endpoint.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function register_rest_endpoint(): void {
		require_once PLL_RETRANSLATE_DIR . 'includes/class-rest-endpoint.php';
		$endpoint = new \WP_Syntex\Polylang_Retranslate\REST_Endpoint( $this->polylang, $this->service );
		$endpoint->register();
	}

	/**
	 * Enqueues block editor assets.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function enqueue_editor_assets(): void {
		wp_enqueue_script(
			'pll-retranslate',
			PLL_RETRANSLATE_URL . 'js/retranslate-panel.js',
			array(
				'wp-plugins',
				'wp-edit-post',
				'wp-element',
				'wp-components',
				'wp-data',
				'wp-api-fetch',
				'wp-i18n',
			),
			PLL_RETRANSLATE_VERSION,
			true
		);

		wp_localize_script(
			'pll-retranslate',
			'pllRetranslateSettings',
			array(
				'defaultLanguage' => pll_default_language(),
			)
		);

		wp_set_script_translations( 'pll-retranslate', 'polylang-retranslate', PLL_RETRANSLATE_DIR . 'languages' );
	}

	/**
	 * Gets the Polylang instance.
	 *
	 * @since 1.0.0
	 *
	 * @return object|null
	 */
	public function get_polylang() {
		return $this->polylang;
	}

	/**
	 * Gets the active translation service.
	 *
	 * @since 1.0.0
	 *
	 * @return object|null
	 */
	public function get_service() {
		return $this->service;
	}
}

// Initialize the plugin.
PLL_Retranslate::instance();
