import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

import 'core/env/env.dart';
import 'core/api_client.dart';
import 'core/auth/auth_service.dart';
import 'core/routes.dart';
import 'core/theme/app_theme.dart';
import 'core/connectivity/connectivity_service.dart';
import 'core/local/local_database.dart';
import 'core/sync/sync_service.dart';


// Select runtime profile at launch:
//   flutter run -t lib/main.dart
//   flutter run -t lib/main.dart --dart-define=ENV=prod
const _profile = String.fromEnvironment('ENV', defaultValue: 'dev');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await GetStorage.init();
  await LocalDatabase.instance.database;
  
  // Initialize baked profiles and select one
  Env.initGenerated();
  try {
    Env.setProfile(_profile);
  } catch (_) {
    Env.setProfile('dev');
  }

  if (!Get.isRegistered<ApiClient>()) Get.put(ApiClient(), permanent: true);
  if (!Get.isRegistered<AuthService>()) Get.put(AuthService(), permanent: true);
  if (!Get.isRegistered<ConnectivityService>()) Get.put(ConnectivityService(), permanent: true);
  if (!Get.isRegistered<SyncService>()) Get.put(SyncService(), permanent: true);

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
