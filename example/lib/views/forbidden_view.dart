import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/auth/auth_service.dart';
import '../core/routes.dart';

class ForbiddenView extends StatelessWidget {
  const ForbiddenView({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Get.isRegistered<AuthService>() ? Get.find<AuthService>() : null;

    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Card(
            clipBehavior: Clip.antiAlias,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.block_outlined,
                      size: 56,
                      color: Theme.of(context).colorScheme.error),
                  const SizedBox(height: 12),
                  Text(
                    'Forbidden'.tr,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    "You don't have permission to access this page.".tr,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => Get.offAllNamed(AppRoutes.home),
                        icon: const Icon(Icons.home_outlined),
                        label: Text('Back to Home'.tr),
                      ),
                      const SizedBox(width: 12),
                      if (auth != null)
                        FilledButton.icon(
                          onPressed: () async {
                            await auth.logout();
                            Get.offAllNamed(AppRoutes.login);
                          },
                          icon: const Icon(Icons.logout),
                          label: Text('Sign out'.tr),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
