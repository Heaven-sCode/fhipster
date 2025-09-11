// generators/splash_controller_generator.js
// Emits lib/controllers/splash_controller.dart
// - Boots the app: initializes GetStorage, ensures ApiClient/AuthService singletons
// - Uses AuthService.bootstrap() to restore/refresh session
// - Routes to Home if authenticated, otherwise to Login
// - Exposes a reactive status message for SplashView

function generateSplashControllerTemplate() {
  return `import 'dart:async';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import '../core/api_client.dart';
import '../core/auth/auth_service.dart';
import '../core/routes.dart';

class SplashController extends GetxController {
  final RxString status = 'Starting...'.obs;

  @override
  void onReady() {
    super.onReady();
    _boot();
  }

  Future<void> _boot() async {
    try {
      status.value = 'Preparing storage...';
      await _initStorage();

      // Ensure core singletons exist (in case routes binding didn't run yet)
      if (!Get.isRegistered<ApiClient>()) {
        Get.put(ApiClient(), permanent: true);
      }
      if (!Get.isRegistered<AuthService>()) {
        Get.put(AuthService(), permanent: true);
      }

      status.value = 'Restoring session...';
      final auth = Get.find<AuthService>();
      final ok = await auth.bootstrap(); // tries refresh if needed

      // Nice tiny delay so splash isn't a flash
      await Future.delayed(const Duration(milliseconds: 250));

      if (ok) {
        status.value = 'Welcome back';
        Get.offAllNamed(AppRoutes.home);
      } else {
        status.value = 'Please sign in';
        Get.offAllNamed(AppRoutes.login);
      }
    } catch (e) {
      status.value = 'Error: ' + e.toString();
      await Future.delayed(const Duration(milliseconds: 400));
      Get.offAllNamed(AppRoutes.login);
    }
  }

  Future<void> _initStorage() async {
    // GetStorage.init() is idempotent/safe to call multiple times.
    try {
      await GetStorage.init();
    } catch (_) {
      // Some environments may have already initialized; ignore.
    }
  }
}
`;
}

module.exports = { generateSplashControllerTemplate };
