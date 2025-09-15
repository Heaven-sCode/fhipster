import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

import 'core/env/env.dart';
import 'core/api_client.dart';
import 'core/auth/auth_service.dart';
import 'core/routes.dart';

// Select runtime profile at launch:
//   flutter run -t lib/main.dart
//   flutter run -t lib/main.dart --dart-define=ENV=prod
const _profile = String.fromEnvironment('ENV', defaultValue: 'dev');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await GetStorage.init();

  // Initialize baked profiles and select one
  Env.initGenerated();
  try {
    Env.setProfile(_profile);
  } catch (_) {
    Env.setProfile('dev');
  }

  if (!Get.isRegistered<ApiClient>()) Get.put(ApiClient(), permanent: true);
  if (!Get.isRegistered<AuthService>()) Get.put(AuthService(), permanent: true);

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
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF2D6CDF),
      ),
    );
  }
}
