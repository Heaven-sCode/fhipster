function generateMainDartTemplate({ enableSQLite = false } = {}) {
  const sqliteImports = enableSQLite ? "import 'core/local/local_database.dart';\n" : '';
  const sqliteInit = enableSQLite ? `  await LocalDatabase.instance.database;\n` : '';
  const connectivityImport = "import 'core/connectivity/connectivity_service.dart';\n";
  const syncImport = enableSQLite ? "import 'core/sync/sync_service.dart';\n" : '';
  const syncRegistration = enableSQLite ? "  if (!Get.isRegistered<SyncService>()) Get.put(SyncService(), permanent: true);\n" : '';

  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

import 'core/env/env.dart';
import 'core/api_client.dart';
import 'core/auth/auth_service.dart';
import 'core/routes.dart';
import 'core/theme/app_theme.dart';
import 'core/preferences/column_preferences.dart';
import 'views/settings/column_preferences_registry.dart';
${connectivityImport}${sqliteImports}${syncImport}

// Select runtime profile at launch:
//   flutter run -t lib/main.dart
//   flutter run -t lib/main.dart --dart-define=ENV=prod
const _profile = String.fromEnvironment('ENV', defaultValue: 'dev');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await GetStorage.init();
${sqliteInit}  
  // Initialize baked profiles and select one
  Env.initGenerated();
  try {
    Env.setProfile(_profile);
  } catch (_) {
    Env.setProfile('dev');
  }

  if (!Get.isRegistered<AuthService>()) Get.put(AuthService(), permanent: true);
  if (!Get.isRegistered<ApiClient>()) Get.put(ApiClient(), permanent: true);
  if (!Get.isRegistered<ConnectivityService>()) Get.put(ConnectivityService(), permanent: true);
  final columnPrefs = Get.put(ColumnPreferencesService(), permanent: true);
  await columnPrefs.init();
  registerAllColumnPreferences(columnPrefs);
${syncRegistration}
  runApp(const FHipsterApp());
}

class FHipsterApp extends StatelessWidget {
  const FHipsterApp({super.key});

  @override
  Widget build(BuildContext context) {
    final cfg = Env.get();
    return GetMaterialApp(
      title: cfg.appName,
      debugShowCheckedModeBanner: false,
      initialRoute: AppRoutes.splash,
      getPages: AppRoutes.pages,
      defaultTransition: Transition.fadeIn,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
    );
  }
}
`;
}

module.exports = { generateMainDartTemplate };
