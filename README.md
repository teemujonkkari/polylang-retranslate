# Polylang Re-translate

A WordPress plugin that adds a "Re-translate" panel to the block editor, allowing you to re-translate existing translations using DeepL machine translation.

## Description

Polylang Re-translate extends Polylang Pro by providing a convenient way to update existing translations with fresh machine translations. Instead of manually copying content and using the translation button for new posts, you can now re-translate any existing translation directly from the source post's editor.

This is particularly useful when:
- Source content has been significantly updated
- You want to refresh translations with improved DeepL models
- You need to bulk-update translations after content revisions

## Requirements

- WordPress 6.2 or higher
- PHP 7.2 or higher
- [Polylang Pro](https://polylang.pro/) 3.6 or higher
- Machine Translation enabled in Polylang Pro settings
- Active DeepL API key configured in Polylang Pro

## Installation

1. Download the plugin files
2. Upload the `polylang-retranslate` folder to `/wp-content/plugins/`
3. Activate the plugin through the 'Plugins' menu in WordPress
4. Ensure Polylang Pro is active with Machine Translation enabled

## Usage

1. Open any post in the **default language** using the block editor
2. Look for the **"Re-translate"** panel in the Document Settings sidebar (right side)
3. You'll see a list of existing translations for the current post
4. Click **"Re-translate"** next to any language to update that translation
5. Confirm the action when prompted (this will overwrite the existing translation)
6. The translation will be updated using DeepL

### Important Notes

- The Re-translate panel **only appears** when editing posts in the default language
- Only **existing translations** can be re-translated (use Polylang Pro's standard flow for new translations)
- Re-translating will **overwrite** the current translation content
- The translation post's status (draft, published, etc.) is preserved

## Features

- **Block Editor Integration**: Native sidebar panel in Gutenberg
- **Per-Language Control**: Re-translate individual languages independently
- **Status Feedback**: Visual indicators for loading, success, and error states
- **Confirmation Dialog**: Prevents accidental overwrites
- **Permission Checks**: Respects WordPress capabilities (edit_post)
- **Post Type Support**: Only works with Polylang-enabled post types
- **Debug Logging**: Optional logging for troubleshooting (when WP_DEBUG is enabled)

## Screenshots

The Re-translate panel appears in the block editor sidebar:

```
┌─────────────────────────────┐
│ Re-translate                │
├─────────────────────────────┤
│ Re-translate existing       │
│ translations using DeepL.   │
│                             │
│ ┌─────────────────────────┐ │
│ │ English                 │ │
│ │ Meeting Minutes         │ │
│ │            [Re-translate]│ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ Swedish                 │ │
│ │ Mötesprotokoll          │ │
│ │            [Re-translate]│ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

## REST API

The plugin registers a REST API endpoint for the translation functionality:

### Endpoint

```
POST /wp-json/pll-retranslate/v1/translate
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source_post_id` | integer | Yes | The ID of the source post to translate from |
| `target_language` | string | Yes | The target language slug (e.g., "en", "sv") |

### Response

**Success (200):**
```json
{
  "success": true,
  "post_id": 123,
  "post_title": "Translated Post Title"
}
```

**Error (4xx/5xx):**
```json
{
  "code": "error_code",
  "message": "Error description",
  "data": {
    "status": 400
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `rest_forbidden` | 403 | User lacks permission to edit source or target post |
| `invalid_source_post` | 404 | Source post not found |
| `invalid_post_type` | 400 | Post type doesn't support translations |
| `invalid_language` | 400 | Target language not configured |
| `no_translation` | 400 | No existing translation found |
| `service_unavailable` | 503 | DeepL service not available |
| `translation_failed` | 500 | DeepL translation error |
| `save_failed` | 500 | Failed to save translated content |

## Debug Logging

When `WP_DEBUG` is enabled, the plugin logs translation operations to `wp-content/debug.log`:

```
[Polylang Re-translate] Re-translation started: user #1, source post #42 ("Post Title") -> en (target post #43)
[Polylang Re-translate] Re-translation completed: post #42 -> en (post #43) by user #1
```

To enable debug logging, add to `wp-config.php`:

```php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
```

## Security

The plugin implements several security measures:

- **Capability Checks**: Users must have `edit_post` capability for both source and target posts
- **Nonce Verification**: Handled automatically by WordPress REST API
- **Input Sanitization**: All inputs are sanitized (`absint`, `sanitize_key`)
- **Post Type Validation**: Only Polylang-enabled post types can be translated
- **ABSPATH Check**: Direct file access is prevented

## Hooks & Filters

The plugin currently does not provide custom hooks or filters. It integrates with Polylang Pro's existing infrastructure:

- Uses `pll_init` action for initialization
- Leverages Polylang Pro's `Machine_Translation\Processor` for translations
- Respects Polylang's post type translation settings

## Changelog

### 1.0.0
- Initial release
- Block editor Re-translate panel
- REST API endpoint for translations
- Debug logging support
- Security hardening (capability checks, input sanitization)
- Performance optimization (query caching)

## Development

### File Structure

```
polylang-retranslate/
├── polylang-retranslate.php    # Main plugin file
├── includes/
│   └── class-rest-endpoint.php # REST API endpoint
├── js/
│   └── retranslate-panel.js    # Block editor panel
├── languages/                   # Translation files (empty)
└── README.md                    # This file
```

### Coding Standards

This plugin follows:
- WordPress Coding Standards
- Polylang Pro conventions (namespaces, PHPDoc with `@since` tags)
- PSR-4 autoloading compatible structure

### Namespace

```php
WP_Syntex\Polylang_Retranslate
```

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/teemujonkkari/polylang-retranslate/issues).

## License

GPL-3.0-or-later

This plugin is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

## Credits

- **Author**: [Teemu Jonkkari](https://github.com/teemujonkkari)
- **Repository**: [github.com/teemujonkkari/polylang-retranslate](https://github.com/teemujonkkari/polylang-retranslate)
- **Powered by**: [Polylang Pro](https://polylang.pro/) and [DeepL](https://www.deepl.com/)
