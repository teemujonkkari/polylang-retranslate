/**
 * Polylang Re-translate Panel for Block Editor.
 *
 * Adds a "Re-translate" panel to the Document Settings sidebar that allows
 * users to re-translate existing translations using DeepL.
 *
 * @package WP_Syntex\Polylang_Retranslate
 * @since 1.0.0
 */

( function() {
	'use strict';

	var registerPlugin = wp.plugins.registerPlugin;
	var PluginDocumentSettingPanel = wp.editPost.PluginDocumentSettingPanel;
	var el = wp.element.createElement;
	var useState = wp.element.useState;
	var Button = wp.components.Button;
	var Spinner = wp.components.Spinner;
	var useSelect = wp.data.useSelect;
	var useDispatch = wp.data.useDispatch;
	var apiFetch = wp.apiFetch;
	var __ = wp.i18n.__;
	var sprintf = wp.i18n.sprintf;

	// Get default language from PHP (pll_default_language()).
	var defaultLanguage = window.pllRetranslateSettings?.defaultLanguage || '';

	/**
	 * Helper function to create a delay.
	 *
	 * @param {number} ms Milliseconds to delay.
	 * @return {Promise} Promise that resolves after the delay.
	 */
	function delay( ms ) {
		return new Promise( function( resolve ) {
			setTimeout( resolve, ms );
		} );
	}

	/**
	 * Re-translate Panel Component.
	 *
	 * Displays a list of existing translations with re-translate buttons.
	 * Only shown when editing a post in the default language.
	 *
	 * @since 1.0.0
	 *
	 * @return {Object|null} React element or null if panel should not be shown.
	 */
	function RetranslatePanel() {
		// Get post data from the editor store.
		var editorData = useSelect( function( select ) {
			var editor = select( 'core/editor' );
			return {
				postId: editor.getCurrentPostId(),
				currentLang: editor.getEditedPostAttribute( 'lang' ),
				translationsTable: editor.getEditedPostAttribute( 'translations_table' )
			};
		}, [] );

		var postId = editorData.postId;
		var currentLang = editorData.currentLang;
		var translationsTable = editorData.translationsTable;

		// Get notice dispatcher.
		var notices = useDispatch( 'core/notices' );

		// State for tracking translation status per language.
		// { [langSlug]: 'idle' | 'loading' | 'success' | 'error' }
		var stateHook = useState( {} );
		var states = stateHook[ 0 ];
		var setStates = stateHook[ 1 ];

		// State for tracking "translate all" progress.
		// null = idle, { current: 1, total: 3 } = in progress
		var allProgressHook = useState( null );
		var allProgress = allProgressHook[ 0 ];
		var setAllProgress = allProgressHook[ 1 ];

		// Only show panel for posts in the default language.
		if ( ! currentLang || currentLang !== defaultLanguage ) {
			return null;
		}

		// Filter to only languages that have existing translations.
		var existingTranslations = [];
		if ( translationsTable ) {
			Object.keys( translationsTable ).forEach( function( slug ) {
				var data = translationsTable[ slug ];
				// Skip the current post's language.
				if ( slug === currentLang ) {
					return;
				}
				// Only include if there's an existing translated post.
				if ( data.translated_post && data.translated_post.id ) {
					existingTranslations.push( {
						slug: slug,
						lang: data.lang,
						postId: data.translated_post.id,
						title: data.translated_post.title
					} );
				}
			} );
		}

		// Don't show panel if there are no existing translations.
		if ( existingTranslations.length === 0 ) {
			return null;
		}

		/**
		 * Handles the re-translate button click for a single language.
		 *
		 * @since 1.0.0
		 *
		 * @param {string} langSlug The target language slug.
		 * @return {void}
		 */
		function handleRetranslate( langSlug ) {
			// Confirm before overwriting.
			var confirmMessage = __(
				'Re-translate this translation? This will overwrite the current translation content.',
				'polylang-retranslate'
			);

			if ( ! window.confirm( confirmMessage ) ) { // phpcs:ignore WordPress.JS.AlertDialogs.Confirm
				return;
			}

			translateSingleLanguage( langSlug );
		}

		/**
		 * Translates a single language without confirmation.
		 *
		 * @since 1.1.0
		 *
		 * @param {string} langSlug The target language slug.
		 * @return {Promise} Promise that resolves when translation is complete.
		 */
		function translateSingleLanguage( langSlug ) {
			// Set loading state.
			setStates( function( prevStates ) {
				var newStates = Object.assign( {}, prevStates );
				newStates[ langSlug ] = 'loading';
				return newStates;
			} );

			// Make API request.
			return apiFetch( {
				path: '/pll-retranslate/v1/translate',
				method: 'POST',
				data: {
					source_post_id: postId,
					target_language: langSlug
				}
			} ).then( function( response ) {
				// Success.
				setStates( function( prevStates ) {
					var newStates = Object.assign( {}, prevStates );
					newStates[ langSlug ] = 'success';
					return newStates;
				} );

				notices.createSuccessNotice(
					/* translators: %s: post title */
					__( 'Translation updated: ', 'polylang-retranslate' ) + response.post_title,
					{ type: 'snackbar' }
				);

				return true;
			} ).catch( function( error ) {
				// Error.
				setStates( function( prevStates ) {
					var newStates = Object.assign( {}, prevStates );
					newStates[ langSlug ] = 'error';
					return newStates;
				} );

				notices.createErrorNotice(
					/* translators: %s: error message */
					__( 'Translation failed: ', 'polylang-retranslate' ) + ( error.message || __( 'Unknown error', 'polylang-retranslate' ) ),
					{ type: 'snackbar' }
				);

				return false;
			} );
		}

		/**
		 * Handles the "Re-translate All" button click.
		 *
		 * @since 1.1.0
		 *
		 * @return {void}
		 */
		function handleRetranslateAll() {
			// Confirm before overwriting all.
			var confirmMessage = sprintf(
				/* translators: %d: number of translations */
				__( 'Re-translate all %d translations? This will overwrite all existing translation content.', 'polylang-retranslate' ),
				existingTranslations.length
			);

			if ( ! window.confirm( confirmMessage ) ) { // phpcs:ignore WordPress.JS.AlertDialogs.Confirm
				return;
			}

			// Start sequential translation with delay.
			( async function() {
				var total = existingTranslations.length;

				for ( var i = 0; i < total; i++ ) {
					var tr = existingTranslations[ i ];

					// Update progress.
					setAllProgress( { current: i + 1, total: total } );

					// Translate this language.
					await translateSingleLanguage( tr.slug );

					// Wait 2 seconds before next (except for last one).
					if ( i < total - 1 ) {
						await delay( 2000 );
					}
				}

				// Done - clear progress.
				setAllProgress( null );

				notices.createSuccessNotice(
					__( 'All translations updated!', 'polylang-retranslate' ),
					{ type: 'snackbar' }
				);
			} )();
		}

		// Check if any translation is currently loading.
		var isAnyLoading = Object.keys( states ).some( function( key ) {
			return states[ key ] === 'loading';
		} );

		// Render the panel.
		return el(
			PluginDocumentSettingPanel,
			{
				name: 'pll-retranslate',
				title: __( 'Re-translate', 'polylang-retranslate' ),
				icon: 'translation'
			},
			el(
				'p',
				{
					style: {
						fontSize: '12px',
						color: '#757575',
						marginTop: 0,
						marginBottom: '12px'
					}
				},
				__( 'Re-translate existing translations using DeepL.', 'polylang-retranslate' )
			),
			// "Re-translate All" button.
			el(
				'div',
				{
					style: {
						marginBottom: '12px'
					}
				},
				allProgress
					? el(
						'div',
						{
							style: {
								display: 'flex',
								alignItems: 'center',
								gap: '8px'
							}
						},
						el( Spinner ),
						el(
							'span',
							null,
							sprintf(
								/* translators: %1$d: current number, %2$d: total number */
								__( 'Translating %1$d / %2$d...', 'polylang-retranslate' ),
								allProgress.current,
								allProgress.total
							)
						)
					)
					: el(
						Button,
						{
							variant: 'primary',
							onClick: handleRetranslateAll,
							disabled: isAnyLoading,
							style: { width: '100%', justifyContent: 'center' }
						},
						__( 'Re-translate All', 'polylang-retranslate' )
					)
			),
			// Individual language buttons.
			existingTranslations.map( function( tr ) {
				var state = states[ tr.slug ] || 'idle';
				var buttonLabel = __( 'Re-translate', 'polylang-retranslate' );

				if ( state === 'success' ) {
					buttonLabel = '✓ ' + __( 'Done', 'polylang-retranslate' );
				} else if ( state === 'error' ) {
					buttonLabel = __( 'Retry', 'polylang-retranslate' );
				}

				return el(
					'div',
					{
						key: tr.slug,
						style: {
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							marginBottom: '8px',
							padding: '8px',
							backgroundColor: '#f6f7f7',
							borderRadius: '2px'
						}
					},
					el(
						'div',
						{
							style: {
								flex: 1,
								marginRight: '8px',
								overflow: 'hidden'
							}
						},
						el(
							'strong',
							{
								style: {
									display: 'block',
									marginBottom: '2px'
								}
							},
							tr.lang.name
						),
						el(
							'span',
							{
								style: {
									fontSize: '12px',
									color: '#757575',
									display: 'block',
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap'
								}
							},
							tr.title || __( '(no title)', 'polylang-retranslate' )
						)
					),
					state === 'loading'
						? el( Spinner )
						: el(
							Button,
							{
								variant: state === 'success' ? 'tertiary' : 'secondary',
								isSmall: true,
								onClick: function() {
									handleRetranslate( tr.slug );
								},
								disabled: isAnyLoading || allProgress !== null
							},
							buttonLabel
						)
				);
			} )
		);
	}

	// Register the plugin.
	registerPlugin( 'pll-retranslate', {
		render: RetranslatePanel,
		icon: 'translation'
	} );
} )();
