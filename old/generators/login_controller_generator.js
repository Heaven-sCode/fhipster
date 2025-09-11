/**
 * Generates the content for the Login Controller.
 * @returns {string} The Dart code for the LoginController.
 */
function generateLoginControllerTemplate() {
    return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/api_client.dart';

class LoginController extends GetxController {
  final ApiClient _apiClient = Get.find<ApiClient>();

  final TextEditingController usernameController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  final formKey = GlobalKey<FormState>();

  final isLoading = false.obs;

  // --- Keycloak Configuration ---
  final String _keycloakBaseUrl = 'https://your-keycloak-domain.com'; // e.g., http://localhost:8080
  final String _realm = 'your-realm-name';
  final String _clientId = 'your-client-id';
  final String? _clientSecret = 'your-client-secret-if-any'; // Set to null if your client is public

  @override
  void onClose() {
    usernameController.dispose();
    passwordController.dispose();
    super.onClose();
  }

  Future<void> login() async {
    if (formKey.currentState?.validate() ?? false) {
      isLoading.value = true;
      try {
        final String tokenUrl = '\$_keycloakBaseUrl/realms/\$_realm/protocol/openid-connect/token';
        
        final Map<String, String> formData = {
          'grant_type': 'password',
          'client_id': _clientId,
          'username': usernameController.text,
          'password': passwordController.text,
        };

        if (_clientSecret != null) {
          formData['client_secret'] = _clientSecret!;
        }

        // Use a separate, clean GetConnect instance for the external Keycloak call.
        final keycloakClient = GetConnect(timeout: const Duration(seconds: 30));
        final response = await keycloakClient.post(tokenUrl, formData);

        if (response.statusCode == 200 && response.body != null) {
          final String accessToken = response.body['access_token'];
          final String refreshToken = response.body['refresh_token'];

          await _apiClient.saveTokens(newAccessToken: accessToken, newRefreshToken: refreshToken);

          Get.snackbar('Success', 'Login successful!');
          // Navigate to your home screen after successful login
          // Get.offAll(() => const HomeScreen());
        } else {
          Get.snackbar('Login Failed', response.body['error_description'] ?? 'Invalid username or password',
              snackPosition: SnackPosition.BOTTOM);
        }
      } catch (e) {
        Get.snackbar('Error', 'An unexpected error occurred: \${e.toString()}',
            snackPosition: SnackPosition.BOTTOM);
      } finally {
        isLoading.value = false;
      }
    }
  }
}
`;
}

module.exports = { generateLoginControllerTemplate };
