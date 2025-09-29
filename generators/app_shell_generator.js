// generators/app_shell_generator.js
// Emits lib/core/app_shell.dart
// - Responsive App Shell for web & mobile
// - Uses Drawer (compact) / NavigationRail (wide)
// - Top AppBar with title, optional actions, user menu (profile/logout)
// - GetX-friendly (no StatefulWidget required in pages)
// - Accepts a list of navigation destinations (route + icon + label)
// - Highlights current route, supports deep routes
//
// Usage in views:
//   return AppShell(
//     title: 'Orders',
//     navDestinations: const [
//       AppDestination(route: AppRoutes.home, icon: Icons.home, label: 'Home'),
//       AppDestination(route: '/order', icon: Icons.list_alt, label: 'Orders'),
//       AppDestination(route: '/customer', icon: Icons.people, label: 'Customers'),
//     ],
//     body: ...,
//   );

function generateAppShellTemplate() {
  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'auth/auth_service.dart';

@immutable
class AppDestination {
  final String route;
  final IconData icon;
  final String label;
  final IconData? selectedIcon;

  const AppDestination({
    required this.route,
    required this.icon,
    required this.label,
    this.selectedIcon,
  });
}

class AppShell extends StatefulWidget {
  final String title;
  final Widget body;
  final List<AppDestination> navDestinations;
  final List<Widget>? actions;
  final Widget? floatingActionButton;
  final EdgeInsetsGeometry bodyPadding;
  final bool showUserMenu;

  const AppShell({
    super.key,
    required this.title,
    required this.body,
    this.navDestinations = const [],
    this.actions,
    this.floatingActionButton,
    this.bodyPadding = const EdgeInsets.all(16),
    this.showUserMenu = true,
  });

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  static const _wideBreakpoint = 1000.0;
  static const _railMin = 72.0;

  bool _railVisible = true;

  @override
  void didUpdateWidget(covariant AppShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.navDestinations.isEmpty && _railVisible) {
      _railVisible = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isWide = width >= _wideBreakpoint;

    final current = Get.currentRoute.isEmpty ? '/' : Get.currentRoute;
    final selectedIndex = _selectedIndex(current, widget.navDestinations);

    final auth = Get.isRegistered<AuthService>() ? Get.find<AuthService>() : null;

    final userMenu = widget.showUserMenu && auth != null
        ? _UserMenu(auth: auth)
        : const SizedBox.shrink();

    final List<Widget> appBarActions = [
      ...(widget.actions ?? const []),
      if (widget.showUserMenu) userMenu,
    ];

    final leadingButton = widget.navDestinations.isEmpty
        ? null
        : Builder(
            builder: (ctx) => IconButton(
              icon: const Icon(Icons.menu),
              onPressed: () {
                if (isWide) {
                  setState(() {
                    _railVisible = !_railVisible;
                  });
                } else {
                  Scaffold.of(ctx).openDrawer();
                }
              },
              tooltip: 'Menu',
            ),
          );

    final appBar = AppBar(
      title: Text(widget.title),
      leading: leadingButton,
      actions: appBarActions,
    );

    final drawer = _AppDrawer(
      destinations: widget.navDestinations,
      selectedIndex: selectedIndex,
      onTap: (i) => _go(widget.navDestinations[i].route),
    );

    final rail = _NavigationRail(
      destinations: widget.navDestinations,
      selectedIndex: selectedIndex,
      onSelect: (i) => _go(widget.navDestinations[i].route),
    );

    if (isWide) {
      return Scaffold(
        appBar: appBar,
        body: Row(
          children: [
            if (widget.navDestinations.isNotEmpty && _railVisible) rail,
            if (widget.navDestinations.isNotEmpty && _railVisible)
              const VerticalDivider(width: 1),
            Expanded(
              child: SafeArea(
                child: Padding(
                  padding: widget.bodyPadding,
                  child: widget.body,
                ),
              ),
            ),
          ],
        ),
        floatingActionButton: widget.floatingActionButton,
      );
    }

    return Scaffold(
      appBar: appBar,
      drawer: widget.navDestinations.isEmpty ? null : drawer,
      body: SafeArea(
        child: Padding(
          padding: widget.bodyPadding,
          child: widget.body,
        ),
      ),
      floatingActionButton: widget.floatingActionButton,
    );
  }

  int _selectedIndex(String currentRoute, List<AppDestination> items) {
    if (items.isEmpty) return -1;
    final exact = items.indexWhere((d) => d.route == currentRoute);
    if (exact >= 0) return exact;
    for (int i = 0; i < items.length; i++) {
      if (currentRoute.startsWith(items[i].route)) return i;
    }
    return 0;
  }

  void _go(String route) {
    if (Get.currentRoute == route) return;
    Get.offNamedUntil(route, (r) => r.settings.name == route || r.isFirst);
  }
}

class _AppDrawer extends StatelessWidget {
  final List<AppDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onTap;

  const _AppDrawer({
    required this.destinations,
    required this.selectedIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (destinations.isEmpty) return const SizedBox.shrink();
    return Drawer(
      child: SafeArea(
        child: ListView.builder(
          itemCount: destinations.length + 1,
          itemBuilder: (context, index) {
            if (index == 0) {
              return DrawerHeader(
                child: Align(
                  alignment: Alignment.bottomLeft,
                  child: Text(
                    'Menu',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
              );
            }
            final i = index - 1;
            final d = destinations[i];
            final selected = i == selectedIndex;
            return ListTile(
              leading: Icon(d.icon),
              title: Text(d.label),
              selected: selected,
              onTap: () {
                Navigator.of(context).maybePop();
                onTap(i);
              },
            );
          },
        ),
      ),
    );
  }
}

class _NavigationRail extends StatelessWidget {
  final List<AppDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  const _NavigationRail({
    required this.destinations,
    required this.selectedIndex,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    if (destinations.isEmpty) {
      return const SizedBox(width: 0, height: double.infinity);
    }
    return NavigationRail(
      minWidth: _AppShellState._railMin,
      selectedIndex: selectedIndex < 0 ? 0 : selectedIndex,
      onDestinationSelected: onSelect,
      labelType: NavigationRailLabelType.selected,
      destinations: destinations
          .map((d) => NavigationRailDestination(
                icon: Icon(d.icon),
                selectedIcon:
                    d.selectedIcon != null ? Icon(d.selectedIcon) : null,
                label: Text(d.label),
              ))
          .toList(),
    );
  }
}

class _UserMenu extends StatelessWidget {
  final AuthService auth;
  const _UserMenu({required this.auth});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final isAuthed = auth.isAuthenticated;
      final initials = _initialsFromName(auth.displayName ?? 'User');
      return PopupMenuButton<String>(
        tooltip: isAuthed ? (auth.displayName ?? 'Account') : 'Account',
        itemBuilder: (ctx) => [
          if (isAuthed)
            PopupMenuItem<String>(
              value: 'profile',
              child: ListTile(
                leading: const Icon(Icons.person),
                title: Text(auth.displayName ?? 'Profile'),
                subtitle: Text(auth.username.value ?? ''),
                contentPadding: EdgeInsets.zero,
              ),
            ),
          if (isAuthed) const PopupMenuDivider(),
          PopupMenuItem<String>(
            value: isAuthed ? 'logout' : 'login',
            child: Row(
              children: [
                Icon(isAuthed ? Icons.logout : Icons.login),
                const SizedBox(width: 8),
                Text(isAuthed ? 'Logout' : 'Login'),
              ],
            ),
          ),
        ],
        onSelected: (v) async {
          if (v == 'logout') {
            await auth.logout();
          } else if (v == 'login') {
            Get.toNamed('/login');
          } else if (v == 'profile') {
            // implement your profile route if needed
          }
        },
        child: CircleAvatar(
          radius: 16,
          child: Text(initials),
        ),
      );
    });
  }

  String _initialsFromName(String name) {
    final parts = name.split(RegExp(r'\\s+')).where((e) => e.isNotEmpty).toList();
    if (parts.isEmpty) return 'U';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
}
`;
}

module.exports = { generateAppShellTemplate };
