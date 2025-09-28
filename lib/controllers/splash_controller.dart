import 'dart:async';
import 'package:get/get.dart';

import '../core/env/env.dart';
import '../core/api_client.dart';
import '../core/auth/auth_service.dart';
import '../core/routes.dart';

class SplashController extends GetxController {
  final RxBool isBusy = true.obs;
  final RxString status = 'Initializing…'.obs;

  @override
  void onReady() {
    super.onReady();
    _start();
  }

  Future<void> _start() async {
    isBusy.value = true;

    status.value = 'Loading environment…';
    // Make sure environment is initialized with baked defaults.
    // (You can still override in main.dart with Env.init(...))
    try {
      Env.initGenerated();
    } catch (_) {
      // already initialized
    }

    status.value = 'Preparing services…';
    // Ensure core singletons
    if (!Get.isRegistered<ApiClient>()) {
      Get.put(ApiClient(), permanent: true);
    }
    if (!Get.isRegistered<AuthService>()) {
      Get.put(AuthService(), permanent: true);
    }

    final auth = Get.find<AuthService>();

    // Optional tiny delay for splash UX
    status.value = 'Checking session…';
    await Future.delayed(const Duration(milliseconds: 400));

    // Attempt session bootstrap (refresh in Keycloak, validate in JWT)
    final ok = await auth.bootstrap();

    isBusy.value = false;

    if (ok && auth.isAuthenticated) {
      status.value = 'Welcome back!';
      Get.offAllNamed(AppRoutes.home);
    } else {
      status.value = 'Redirecting to login…';
      Get.offAllNamed(AppRoutes.login);
    }
  }
}
