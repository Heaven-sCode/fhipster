// generators/splash_view_generator.js
// Emits lib/views/splash_view.dart
// - Minimal splash screen that shows app name/logo + reactive status
// - Observes SplashController.status
// - No navigation logic here (handled by SplashController)

function generateSplashViewTemplate() {
  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/env/env.dart';
import '../controllers/splash_controller.dart';

class SplashView extends GetView<SplashController> {
  const SplashView({super.key});

  @override
  Widget build(BuildContext context) {
    final appName = Env.get().appName;

    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.apps, size: 64, color: Theme.of(context).colorScheme.primary),
                const SizedBox(height: 12),
                Text(
                  appName,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 24),
                const SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                ),
                const SizedBox(height: 12),
                Obx(() => AnimatedSwitcher(
                      duration: const Duration(milliseconds: 250),
                      child: Text(
                        controller.status.value,
                        key: ValueKey(controller.status.value),
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                      ),
                    )),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
`;
}

module.exports = { generateSplashViewTemplate };
