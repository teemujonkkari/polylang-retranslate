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

	// Get default language from PHP (pll_default_language()).
	var defaultLanguage = window.pllRetranslateSettings?.defaultLanguage || '';

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
		 * Handles the re-translate button click.
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

			// Set loading state.
			var newStates = Object.assign( {}, states );
			newStates[ langSlug ] = 'loading';
			setStates( newStates );

			// Make API request.
			apiFetch( {
				path: '/pll-retranslate/v1/translate',
				method: 'POST',
				data: {
					source_post_id: postId,
					target_language: langSlug
				}
			} ).then( function( response ) {
				// Success.
				var successStates = Object.assign( {}, states );
				successStates[ langSlug ] = 'success';
				setStates( successStates );

				notices.createSuccessNotice(
					/* translators: %s: post title */
					__( 'Translation updated: ', 'polylang-retranslate' ) + response.post_title,
					{ type: 'snackbar' }
				);
			} ).catch( function( error ) {
				// Error.
				var errorStates = Object.assign( {}, states );
				errorStates[ langSlug ] = 'error';
				setStates( errorStates );

				notices.createErrorNotice(
					/* translators: %s: error message */
					__( 'Translation failed: ', 'polylang-retranslate' ) + ( error.message || __( 'Unknown error', 'polylang-retranslate' ) ),
					{ type: 'snackbar' }
				);
			} );
		}

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
								disabled: state === 'loading'
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
