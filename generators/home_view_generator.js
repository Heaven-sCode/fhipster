// generators/home_view_generator.js
// Emits lib/views/home_view.dart
// - Lightweight dashboard-style home using AppShell
// - Greets the signed-in user (via AuthService)
// - Shows environment summary and quick actions
// - Safe to use without an explicit HomeController

function generateHomeViewTemplate() {
  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/app_shell.dart';
import '../core/env/env.dart';
import '../core/auth/auth_service.dart';
import '../core/routes.dart';

class HomeView extends StatelessWidget {
  const HomeView({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Get.isRegistered<AuthService>() ? Get.find<AuthService>() : null;
    final env = Env.get();

    return AppShell(
      title: 'Home',
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Greeting
            if (auth != null) Obx(() {
              final name = auth.displayName ?? auth.username.value ?? 'User';
              return Text('Welcome, $name', style: Theme.of(context).textTheme.headlineSmall);
            }) else
              Text('Welcome', style: Theme.of(context).textTheme.headlineSmall),

            const SizedBox(height: 16),

            // Cards grid
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                _HomeCard(
                  icon: Icons.account_circle_outlined,
                  title: 'Account',
                  child: auth != null ? Obx(() {
                    final roles = auth.authorities;
                    final at = auth.accessTokenExpiry;
                    final rt = auth.refreshTokenExpiry;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _kv('Username', auth.username.value),
                        _kv('Display name', auth.displayName ?? '-'),
                        _kv('Roles', roles.isEmpty ? '-' : roles.join(', ')),
                        _kv('Access token exp', at != null ? at.toLocal().toString() : '-'),
                        _kv('Refresh token exp', rt != null ? rt.toLocal().toString() : '-'),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            FilledButton.icon(
                              onPressed: () => auth.logout(),
                              icon: const Icon(Icons.logout),
                              label: const Text('Logout'),
                            ),
                            const SizedBox(width: 8),
                            OutlinedButton.icon(
                              onPressed: () => auth.refreshNow(),
                              icon: const Icon(Icons.refresh),
                              label: const Text('Refresh token'),
                            ),
                          ],
                        ),
                      ],
                    );
                  }) : const Text('Not authenticated'),
                ),

                _HomeCard(
                  icon: Icons.settings_outlined,
                  title: 'Environment',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _kv('App name', env.appName),
                      _kv('Env name', env.envName),
                      _kv('API host', env.apiHost),
                      _kv('Use gateway', env.useGateway.toString()),
                      _kv('Gateway service', env.gatewayServiceName ?? '-'),
                      _kv('Token endpoint', env.tokenEndpoint),
                      _kv('Client ID', env.keycloakClientId),
                      _kv('Scopes', env.keycloakScopes.join(' ')),
                    ],
                  ),
                ),

                _HomeCard(
                  icon: Icons.table_view_outlined,
                  title: 'Entities',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text('Use the left navigation (rail/drawer) or routes like "/<entity>"'),
                      SizedBox(height: 4),
                      Text('Each entity page provides search, pagination, and CRUD dialogs.'),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget child;

  const _HomeCard({
    required this.icon,
    required this.title,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 280, maxWidth: 520),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, color: t.colorScheme.primary),
                  const SizedBox(width: 8),
                  Text(title, style: t.textTheme.titleLarge),
                ],
              ),
              const SizedBox(height: 12),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

Widget _kv(String k, Object? v) {
  final value = _stringifyValue(v);
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: 160, child: Text(k, style: Get.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600))),
        const SizedBox(width: 8),
        Expanded(child: SelectableText(value)),
      ],
    ),
  );
}

String _stringifyValue(Object? value) {
  if (value == null) return '-';
  if (value is String && value.trim().isEmpty) return '-';
  return value.toString();
}
`;
}

module.exports = { generateHomeViewTemplate };
