const { tableViewClassName, tableViewFileName } = require('../utils/naming');

function generateColumnPreferencesRegistryTemplate(entityNames = []) {
  const uniqueEntities = Array.from(new Set(entityNames || []));
  const importLines = uniqueEntities
    .map((name) => `import '../${tableViewFileName(name)}' show ${tableViewClassName(name)};`)
    .join('\n');
  const registerCalls = uniqueEntities
    .map((name) => `${tableViewClassName(name)}.registerColumns(prefs);`)
    .join('\n  ');

  return `import '../../core/preferences/column_preferences.dart';

${importLines}

void registerAllColumnPreferences(ColumnPreferencesService prefs) {
  ${registerCalls}
}
`;
}

module.exports = { generateColumnPreferencesRegistryTemplate };
