import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../widgets/fhipster_input_field.dart';
import '../controllers/login_controller.dart';

class LoginView extends GetView<LoginController> {
  const LoginView({super.key});

  @override
  Widget build(BuildContext context) {
    // Keep the form key local so we can keep a const ctor for this view.
    final formKey = GlobalKey<FormState>();

    return Scaffold(
      body: LayoutBuilder(
        builder: (context, constraints) {
          final isWide = constraints.maxWidth >= 900;
          return Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Card(
                  clipBehavior: Clip.antiAlias,
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Form(
                      key: formKey,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Header
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.lock_outline,
                                  size: 36,
                                  color: Theme.of(context).colorScheme.primary),
                              const SizedBox(width: 12),
                              Text('Sign in',
                                  style: Theme.of(context).textTheme.headlineSmall),
                            ],
                          ),
                          const SizedBox(height: 24),

                          // Username
                          FHipsterInputField(
                            controller: controller.usernameCtrl,
                            label: 'Username'.tr,
                            hint: 'you@company.com'.tr,
                            keyboardType: TextInputType.emailAddress,
                            validator: (v) =>
                                (v == null || v.isEmpty) ? 'Please enter username'.tr : null,
                          ),
                          const SizedBox(height: 12),

                          // Password
                          FHipsterInputField(
                            controller: controller.passwordCtrl,
                            label: 'Password'.tr,
                            hint: '••••••••'.tr,
                            isPassword: true,
                            validator: (v) =>
                                (v == null || v.isEmpty) ? 'Please enter password'.tr : null,
                          ),
                          const SizedBox(height: 8),

                          // Remember me + Forgot
                          Obx(() => Row(
                                children: [
                                  Checkbox(
                                    value: controller.rememberMe.value,
                                    onChanged: (v) =>
                                        controller.rememberMe.value = v ?? false,
                                  ),
                                  const SizedBox(width: 4),
                                  Text('Remember me'.tr),
                                  const Spacer(),
                                  TextButton(
                                    onPressed: () {
                                      // Optional: route to a "Forgot password" or open SSO page.
                                      // For Keycloak, this is typically handled outside the app.
                                    },
                                    child: Text('Forgot?'.tr),
                                  ),
                                ],
                              )),
                          const SizedBox(height: 8),

                          // Error message
                          Obx(() {
                            final err = controller.errorText.value;
                            if (err == null || err.isEmpty) return const SizedBox.shrink();
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 8.0),
                              child: Text(
                                err,
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            );
                          }),

                          // Submit
                          Obx(() {
                            final busy = controller.isBusy.value;
                            return FilledButton.icon(
                              onPressed: busy
                                  ? null
                                  : () {
                                      if (formKey.currentState?.validate() ?? false) {
                                        controller.submit();
                                      }
                                    },
                              icon: busy
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Icon(Icons.login),
                              label: Text(busy ? 'Signing in...'.tr : 'Sign in'.tr),
                            );
                          }),

                          const SizedBox(height: 4),
                          if (isWide) const SizedBox(height: 4),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
