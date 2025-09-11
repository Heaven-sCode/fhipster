/**
 * Generates the content for the Home View.
 * @returns {string} The Dart code for the HomeView.
 */
function generateHomeViewTemplate() {
    return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/api_client.dart';
import 'login_view.dart'; // To navigate back to login on logout

class HomeView extends StatelessWidget {
  const HomeView({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final ApiClient apiClient = Get.find<ApiClient>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await apiClient.clearTokens();
              Get.offAll(() => const LoginView());
            },
          ),
        ],
      ),
      body: const Center(
        child: Text(
          'Welcome!',
          style: TextStyle(fontSize: 24),
        ),
      ),
    );
  }
}
`;
}

module.exports = { generateHomeViewTemplate };
