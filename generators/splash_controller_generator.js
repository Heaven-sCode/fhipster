// generators/splash_controller_generator.js
// Emits: lib/controllers/splash_controller.dart
// - Initializes Env (generated defaults) so app runs even if main.dart forgets
// - Ensures ApiClient/AuthService are registered
// - Calls AuthService.bootstrap() (dual-auth aware)
// - Routes to home if authenticated, else login

function generateSplashControllerTemplate() {
  return `import 'dart:async';
import 'package:get/get.dart';

import '../core/env/env.dart';
import '../core/api_client.dart';
import '../core/auth/auth_service.dart';
import '../core/routes.dart';

class SplashController extends GetxController {
  final RxBool isBusy = true.obs;

  @override
  void onReady() {
    super.onReady();
    _start();
  }

  Future<void> _start() async {
    isBusy.value = true;

    // Make sure environment is initialized with baked defaults.
    // (You can still override in main.dart with Env.init(...))
    try {
      Env.initGenerated();
    } catch (_) {
      // already initialized
    }

    // Ensure core singletons
    if (!Get.isRegistered<ApiClient>()) {
      Get.put(ApiClient(), permanent: true);
    }
    if (!Get.isRegistered<AuthService>()) {
      Get.put(AuthService(), permanent: true);
    }

    final auth = Get.find<AuthService>();

    // Optional tiny delay for splash UX
    await Future.delayed(const Duration(milliseconds: 400));

    // Attempt session bootstrap (refresh in Keycloak, validate in JWT)
    final ok = await auth.bootstrap();

    isBusy.value = false;

    if (ok && auth.isAuthenticated) {
      Get.offAllNamed(AppRoutes.home);
    } else {
      Get.offAllNamed(AppRoutes.login);
    }
  }
}
`;
}

module.exports = { generateSplashControllerTemplate };
