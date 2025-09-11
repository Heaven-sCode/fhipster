/**
 * Generates the content for the central ApiClient service using GetStorage.
 * @returns {string} The Dart code for the ApiClient service.
 */
function generateApiClientTemplate() {
    return `import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import 'dart:async';

class ApiClient extends GetxService {
  final GetConnect _getConnect = GetConnect(timeout: const Duration(seconds: 30));
  final GetStorage _storage = GetStorage();

  // --- Keycloak Configuration ---
  // IMPORTANT: Replace these with your actual Keycloak details.
  final String _keycloakBaseUrl = 'https://your-keycloak-domain.com'; // e.g., http://localhost:8080
  final String _realm = 'your-realm-name';
  final String _clientId = 'your-client-id';

  // --- State Management for Token Refresh ---
  bool _isRefreshing = false;
  Completer<void>? _refreshCompleter;

  // --- Token Management using GetStorage ---

  Future<String?> getAccessToken() async {
    return _storage.read('accessToken');
  }

  Future<String?> getRefreshToken() async {
    return _storage.read('refreshToken');
  }

  Future<void> saveTokens({required String newAccessToken, required String newRefreshToken}) async {
    await _storage.write('accessToken', newAccessToken);
    await _storage.write('refreshToken', newRefreshToken);
    print('New tokens saved to GetStorage.');
  }

  Future<void> clearTokens() async {
    await _storage.remove('accessToken');
    await _storage.remove('refreshToken');
    print('Tokens cleared from GetStorage.');
    // You would also likely navigate the user to the login screen here.
    // Get.offAll(() => const LoginView());
  }

  // --- Interceptor Logic ---

  @override
  void onInit() {
    super.onInit();
    
    // Request Interceptor
    _getConnect.httpClient.addRequestModifier<dynamic>((request) async {
      if (_isRefreshing) {
        await _refreshCompleter?.future;
      }
      
      final token = await getAccessToken();
      if (token != null) {
        request.headers['Authorization'] = 'Bearer \$token';
      }
      return request;
    });

    // Response Interceptor
    _getConnect.httpClient.addResponseModifier((request, response) async {
      if (response.statusCode == 401) {
        if (_isRefreshing) {
          await _refreshCompleter?.future;
          return _getConnect.request(request.url.path, request.method,
              body: request.bodyBytes, headers: request.headers);
        }

        _isRefreshing = true;
        _refreshCompleter = Completer<void>();

        try {
          final newTokens = await refreshToken();
          if (newTokens != null) {
            await saveTokens(
              newAccessToken: newTokens['access_token']!,
              newRefreshToken: newTokens['refresh_token']!,
            );

            _refreshCompleter!.complete();
            _isRefreshing = false;
            
            return _getConnect.request(request.url.path, request.method,
                body: request.bodyBytes, headers: request.headers);
          } else {
            throw Exception('Refresh token failed');
          }
        } catch (e) {
          _isRefreshing = false;
          if (!_refreshCompleter!.isCompleted) {
            _refreshCompleter!.completeError(e);
          }
          await clearTokens();
          return response;
        }
      }
      return response;
    });
  }

  // This method makes the API call to your Keycloak refresh token endpoint.
  Future<Map<String, String>?> refreshToken() async {
    final refreshToken = await getRefreshToken();
    if (refreshToken == null) {
      throw Exception('No refresh token available.');
    }

    final String tokenUrl = '\$_keycloakBaseUrl/realms/\$_realm/protocol/openid-connect/token';
    
    final Map<String, String> formData = {
      'grant_type': 'refresh_token',
      'client_id': _clientId,
      'refresh_token': refreshToken,
    };

    // Use a separate, clean GetConnect instance for the external Keycloak call.
    final keycloakClient = GetConnect(timeout: const Duration(seconds: 30));
    final response = await keycloakClient.post(tokenUrl, formData);

    if (response.statusCode == 200 && response.body != null) {
      return Map<String, String>.from(response.body);
    } else {
      print('Keycloak refresh token failed: \${response.statusCode} \${response.body}');
      return null;
    }
  }

  // Expose the configured GetConnect instance to the services.
  GetConnect get getConnect => _getConnect;
}
`;
}

module.exports = { generateApiClientTemplate };
