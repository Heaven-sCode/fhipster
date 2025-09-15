import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'core/auth/auth_service.dart';

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

class AppShell extends StatelessWidget {
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

  static const _wideBreakpoint = 1000.0;
  static const _railMin = 72.0;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isWide = width >= _wideBreakpoint;

    final current = Get.currentRoute.isEmpty ? '/' : Get.currentRoute;
    final selectedIndex = _selectedIndex(current, navDestinations);

    final auth = Get.isRegistered<AuthService>() ? Get.find<AuthService>() : null;

    final menuButton = IconButton(
      icon: const Icon(Icons.menu),
      onPressed: () {
        if (!isWide) {
          Scaffold.of(context).openDrawer();
        }
      },
      tooltip: 'Menu',
    );

    final userMenu = showUserMenu && auth != null
        ? _UserMenu(auth: auth)
        : const SizedBox.shrink();

    final List<Widget> appBarActions = [
      ...(actions ?? const []),
      if (showUserMenu) userMenu,
    ];

    final appBar = AppBar(
      title: Text(title),
      leading: isWide ? null : Builder(builder: (ctx) => menuButton),
      actions: appBarActions,
    );

    final drawer = _AppDrawer(
      destinations: navDestinations,
      selectedIndex: selectedIndex,
      onTap: (i) => _go(navDestinations[i].route),
    );

    final rail = _NavigationRail(
      destinations: navDestinations,
      selectedIndex: selectedIndex,
      onSelect: (i) => _go(navDestinations[i].route),
    );

    if (isWide) {
      // Rail layout
      return Scaffold(
        appBar: appBar,
        body: Row(
          children: [
            if (navDestinations.isNotEmpty) rail,
            const VerticalDivider(width: 1),
            Expanded(
              child: SafeArea(
                child: Padding(
                  padding: bodyPadding,
                  child: body,
                ),
              ),
            ),
          ],
        ),
        floatingActionButton: floatingActionButton,
      );
    }

    // Drawer layout
    return Scaffold(
      appBar: appBar,
      drawer: navDestinations.isEmpty ? null : drawer,
      body: SafeArea(
        child: Padding(
          padding: bodyPadding,
          child: body,
        ),
      ),
      floatingActionButton: floatingActionButton,
      // Optional: a bottom nav if you want (commented out by default)
      // bottomNavigationBar: navDestinations.length >= 2
      //     ? NavigationBar(
      //         selectedIndex: selectedIndex < 0 ? 0 : selectedIndex,
      //         onDestinationSelected: (i) => _go(navDestinations[i].route),
      //         destinations: navDestinations
      //             .map((d) => NavigationDestination(
      //                   icon: Icon(d.icon),
      //                   selectedIcon: d.selectedIcon != null ? Icon(d.selectedIcon) : null,
      //                   label: d.label,
      //                 ))
      //             .toList(),
      //       )
      //     : null,
    );
  }

  int _selectedIndex(String currentRoute, List<AppDestination> items) {
    if (items.isEmpty) return -1;
    // Try exact match first
    final exact = items.indexWhere((d) => d.route == currentRoute);
    if (exact >= 0) return exact;
    // Try startsWith (to handle nested routes like /order/123/edit)
    for (int i = 0; i < items.length; i++) {
      if (currentRoute.startsWith(items[i].route)) return i;
    }
    return 0;
  }

  void _go(String route) {
    if (Get.currentRoute == route) return;
    // Prefer offNamedUntil to avoid huge stacks for lateral nav
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
      minWidth: AppShell._railMin,
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
                subtitle: Text(auth.username ?? ''),
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
    final parts = name.split(RegExp(r'\s+')).where((e) => e.isNotEmpty).toList();
    if (parts.isEmpty) return 'U';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
}
