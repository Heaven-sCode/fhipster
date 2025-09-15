// generators/translations_generator.js
// Emits lib/core/translations/app_translations.dart with basic key map.

const DEFAULT_KEYS = {
  'New': 'New',
  'Refresh': 'Refresh',
  'Search': 'Search',
  'Rows per page:': 'Rows per page:',
  'Previous': 'Previous',
  'Next': 'Next',
  'Delete': 'Delete',
  'Are you sure?': 'Are you sure?',
  'Error': 'Error',
  'Success': 'Success',
};

function generateTranslationsTemplate(extraKeys = {}) {
  const merged = { ...DEFAULT_KEYS, ...extraKeys };
  const entries = Object.entries(merged)
    .map(([k, v]) => `          '${escape(k)}': '${escape(v)}',`)
    .join('\n');

  return `import 'package:get/get.dart';

/// Basic translation map. Extend this file before regenerating to retain custom strings.
class AppTranslations extends Translations {
  @override
  Map<String, Map<String, String>> get keys => {
        'en_US': {
${entries}
        },
      };
}
`;
}

function escape(str = '') {
  return String(str).replace(/'/g, "\\'");
}

module.exports = { generateTranslationsTemplate };
