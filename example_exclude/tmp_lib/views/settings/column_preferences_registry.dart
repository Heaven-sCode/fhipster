import '../../core/preferences/column_preferences.dart';

import '../properties_table_view.dart' show PropertiesTableView;
import '../media_assets_table_view.dart' show MediaAssetsTableView;

void registerAllColumnPreferences(ColumnPreferencesService prefs) {
  PropertiesTableView.registerColumns(prefs);
  MediaAssetsTableView.registerColumns(prefs);
}
