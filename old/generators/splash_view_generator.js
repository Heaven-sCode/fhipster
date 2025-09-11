/**
 * Generates the content for the Splash View.
 * @returns {string} The Dart code for the SplashView.
 */
function generateSplashViewTemplate() {
    return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../controllers/splash_controller.dart';

class SplashView extends StatelessWidget {
  const SplashView({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // Initialize the controller, which will automatically trigger the auth check.
    Get.put(SplashController());

    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 20),
            Text('Loading...'),
          ],
        ),
      ),
    );
  }
}
`;
}

module.exports = { generateSplashViewTemplate };
