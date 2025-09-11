// generators/unauthorized_view_generator.js
// Emits lib/views/unauthorized_view.dart
// - Simple 401 screen prompting user to sign in
// - Navigates to AppRoutes.login
// - Minimal, theme-friendly UI

function generateUnauthorizedViewTemplate() {
  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/routes.dart';

class UnauthorizedView extends StatelessWidget {
  const UnauthorizedView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Card(
            clipBehavior: Clip.antiAlias,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.lock_person_outlined,
                      size: 56,
                      color: Theme.of(context).colorScheme.primary),
                  const SizedBox(height: 12),
                  Text(
                    'Unauthorized'.tr,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'You are not signed in or your session has expired.'.tr,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: () => Get.offAllNamed(AppRoutes.login),
                    icon: const Icon(Icons.login),
                    label: Text('Go to Login'.tr),
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
`;
}

module.exports = { generateUnauthorizedViewTemplate };
