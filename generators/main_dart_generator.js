// generators/main_dart_generator.js
// Emits lib/main.dart
// - Boots GetX, GetStorage, and Env
// - Registers ApiClient + AuthService singletons
// - Wires GetMaterialApp with AppRoutes
// - Safe default; users can edit freely

function generateMainDartTemplate() {
  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

import 'core/env/env.dart';
import 'core/api_client.dart';
import 'core/auth/auth_service.dart';
import 'core/routes.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await GetStorage.init();

  // Use baked configuration from generated env.dart.
  // You can override with Env.init(EnvConfig(...)) instead.
  Env.initGenerated();

  // Register core singletons up front (routes also ensure these).
  if (!Get.isRegistered<ApiClient>()) Get.put(ApiClient(), permanent: true);
  if (!Get.isRegistered<AuthService>()) Get.put(AuthService(), permanent: true);

  runApp(const FHipsterApp());
}

class FHipsterApp extends StatelessWidget {
  const FHipsterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: Env.get().appName,
      debugShowCheckedModeBanner: false,
      initialRoute: AppRoutes.splash,
      getPages: AppRoutes.pages,
      defaultTransition: Transition.fadeIn,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF2D6CDF),
        brightness: Brightness.light,
      ),
      // translations: YourTranslations(), // optional
      // locale: const Locale('en'),
      // fallbackLocale: const Locale('en'),
    );
  }
}
`;
}

module.exports = { generateMainDartTemplate };
