/**
 * Generates the content for the Splash Controller.
 * @returns {string} The Dart code for the SplashController.
 */
function generateSplashControllerTemplate() {
    return `import 'package:get/get.dart';
import '../core/api_client.dart';
import '../views/home_view.dart';
import '../views/login_view.dart';

class SplashController extends GetxController {
  final ApiClient _apiClient = Get.find<ApiClient>();

  @override
  void onReady() {
    super.onReady();
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    // Give a slight delay to show the splash screen
    await Future.delayed(const Duration(seconds: 2));

    try {
      // The refreshToken method will throw an exception if no refresh token is found.
      final newTokens = await _apiClient.refreshToken(); 
      
      // If we are here, the refresh was successful.
      await _apiClient.saveTokens(
        newAccessToken: newTokens!['access_token']!,
        newRefreshToken: newTokens['refresh_token']!,
      );
      Get.offAll(() => const HomeView());

    } catch (e) {
      // Any error during refresh (no token, invalid token, network error) means
      // the user needs to log in.
      print('Splash screen check failed: \$e');
      await _apiClient.clearTokens();
      Get.offAll(() => const LoginView());
    }
  }
}
`;
}

module.exports = { generateSplashControllerTemplate };
