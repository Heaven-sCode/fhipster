import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../core/auth/auth_service.dart';
import '../core/routes.dart';

class LoginController extends GetxController {
  final usernameCtrl = TextEditingController();
  final passwordCtrl = TextEditingController();

  final RxBool rememberMe = true.obs;
  final RxBool isBusy = false.obs;
  final RxnString errorText = RxnString();

  AuthService get _auth {
    if (!Get.isRegistered<AuthService>()) {
      Get.put(AuthService(), permanent: true);
    }
    return Get.find<AuthService>();
  }

  @override
  void onInit() {
    super.onInit();
    // Pre-fill remembered username if available
    final remembered = _auth.rememberedUsername;
    if (remembered != null && remembered.isNotEmpty) {
      usernameCtrl.text = remembered;
    }
  }

  @override
  void onClose() {
    usernameCtrl.dispose();
    passwordCtrl.dispose();
    super.onClose();
  }

  Future<void> submit() async {
    final username = usernameCtrl.text.trim();
    final password = passwordCtrl.text;

    errorText.value = null;

    if (username.isEmpty || password.isEmpty) {
      errorText.value = 'Please enter username and password'.tr;
      return;
    }

    isBusy.value = true;
    try {
      final ok = await _auth.loginWithPassword(username, password);
      if (ok && _auth.isAuthenticated) {
        // Store or clear remembered username
        if (rememberMe.value) {
          await _auth.rememberUsername(username);
        } else {
          await _auth.forgetRememberedUsername();
        }
        // Navigate to home
        Get.offAllNamed(AppRoutes.home);
      } else {
        errorText.value = 'Invalid credentials or session error'.tr;
      }
    } catch (e) {
      errorText.value = e.toString();
    } finally {
      isBusy.value = false;
    }
  }
}
