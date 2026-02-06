=== Polylang Re-translate ===
Contributors: teemujonkkari
Tags: polylang, translation, deepl, multilingual, machine-translation
Requires at least: 6.2
Tested up to: 6.7
Requires PHP: 7.2
Stable tag: 1.1.0
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Re-translate existing translations using DeepL directly from the block editor. Requires Polylang Pro with Machine Translation enabled.

== Description ==

Polylang Re-translate extends Polylang Pro by adding a "Re-translate" panel to the block editor sidebar. This allows you to update existing translations with fresh machine translations without leaving the editor.

**Use Cases:**

* Source content has been significantly updated
* You want to refresh translations with improved DeepL models
* You need to bulk-update translations after content revisions

**Features:**

* **Re-translate All** - Bulk re-translate all languages with one click
* **Block Editor Integration** - Native sidebar panel in Gutenberg
* **Per-Language Control** - Re-translate individual languages independently
* **Quick Edit Links** - Open translation editor directly in a new tab
* **Status Feedback** - Visual indicators for loading, success, and error states
* **Confirmation Dialog** - Prevents accidental overwrites
* **Permission Checks** - Respects WordPress capabilities
* **Debug Logging** - Optional logging when WP_DEBUG is enabled
* **Translations** - Finnish language support included

**Requirements:**

* Polylang Pro 3.6 or higher
* Machine Translation enabled in Polylang Pro settings
* Active DeepL API key configured in Polylang Pro

== Installation ==

1. Upload the `polylang-retranslate` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Ensure Polylang Pro is active with Machine Translation enabled
4. Open any post in the default language to see the Re-translate panel

== Frequently Asked Questions ==

= Why don't I see the Re-translate panel? =

The panel only appears when:
* You are editing a post in the default language
* The post has existing translations
* Polylang Pro is active with Machine Translation enabled

= Will this overwrite my existing translations? =

Yes. Re-translating will replace the current translation content with a fresh machine translation. A confirmation dialog prevents accidental overwrites.

= Does this work with all post types? =

It works with any post type that has translation support enabled in Polylang settings.

== Changelog ==

= 1.1.0 =
* Add "Re-translate All" button for bulk translation
* Add external link icon to open translation editor in new tab
* Sequential translation with 1 second delay to avoid API rate limits
* Progress indicator for bulk translations

= 1.0.1 =
* Add Finnish translations
* Improve dependency notice with Polylang Pro link
* Fix translation loading for JavaScript strings

= 1.0.0 =
* Initial release
* Block editor Re-translate panel
* REST API endpoint for translations
* Debug logging support
* Security hardening (capability checks, input sanitization)
* Performance optimization (query caching)

== Upgrade Notice ==

= 1.1.0 =
New feature: Re-translate all languages at once with the new bulk translation button.

= 1.0.0 =
Initial release.
