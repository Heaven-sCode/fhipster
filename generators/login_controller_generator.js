// generators/login_controller_generator.js
// Emits lib/controllers/login_controller.dart
// - GetX controller for the login screen
// - Uses AuthService (which wraps ApiClient with Keycloak token/refresh flow)
// - Simple "username/password" Direct Access Grant (password grant) against Keycloak
// - Exposes busy/error state and TextEditingControllers
// - Navigates to AppRoutes.home on success

function generateLoginControllerTemplate() {
  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/auth/auth_service.dart';
import '../core/routes.dart';

class LoginController extends GetxController {
  final TextEditingController usernameCtrl = TextEditingController();
  final TextEditingController passwordCtrl = TextEditingController();

  final RxBool isBusy = false.obs;
  final RxnString errorText = RxnString();
  final RxBool rememberMe = false.obs;
  final RxBool obscure = true.obs;

  AuthService get _auth {
    if (!Get.isRegistered<AuthService>()) Get.put(AuthService(), permanent: true);
    return Get.find<AuthService>();
  }

  @override
  void onClose() {
    usernameCtrl.dispose();
    passwordCtrl.dispose();
    super.onClose();
  }

  Future<void> submit() async {
    final username = usernameCtrl.text.trim();
    final password = passwordCtrl.text; // allow spaces in password

    if (username.isEmpty || password.isEmpty) {
      errorText.value = 'Username and password are required'.tr;
      _toast(errorText.value!);
      return;
    }

    isBusy.value = true;
    errorText.value = null;

    try {
      final ok = await _auth.loginWithPassword(username, password);
      if (ok) {
        // You can persist the last username if rememberMe is true (AuthService may also handle it)
        if (rememberMe.value) {
          _auth.rememberUsername(username);
        } else {
          _auth.forgetRememberedUsername();
        }
        Get.offAllNamed(AppRoutes.home);
        return;
      }
      errorText.value = 'Invalid credentials'.tr;
      _toast(errorText.value!);
    } catch (e) {
      errorText.value = e.toString();
      _toast(errorText.value!);
    } finally {
      isBusy.value = false;
    }
  }

  void toggleObscure() => obscure.value = !obscure.value;

  void _toast(String msg) {
    if (!Get.isSnackbarOpen) {
      Get.snackbar('Login', msg, snackPosition: SnackPosition.BOTTOM, duration: const Duration(seconds: 3));
    }
  }
}
`;
}

module.exports = { generateLoginControllerTemplate };
