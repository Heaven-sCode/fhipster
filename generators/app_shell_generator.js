// generators/app_shell_generator.js
// Emits lib/core/app_shell.dart
// - Responsive App Shell for web & mobile
// - Uses NavigationSidebar for responsive navigation
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

function generateAppShellTemplate(isModule = false) {
  const authImport = isModule ? "" : "import 'auth/auth_service.dart';";
  const navigationSidebarImport = isModule ? "" : "import '../widgets/navigation_sidebar.dart';\n";
  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
${authImport}
import 'navigation_destinations.dart';
${navigationSidebarImport}

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
  static List<AppDestination> _navCache = const [];

  const AppShell({
    super.key,
    required this.title,
    required this.body,
    this.navDestinations = globalNavDestinations,
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

  bool _railVisible = true;
  late List<AppDestination> _navItems;

  @override
  void initState() {
    super.initState();
    _navItems = widget.navDestinations.isNotEmpty
        ? widget.navDestinations
        : AppShell._navCache;
    if (_navItems.isNotEmpty) {
      AppShell._navCache = _navItems;
    }
    if (_navItems.isEmpty) {
      _railVisible = false;
    }
  }

  @override
  void didUpdateWidget(covariant AppShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.navDestinations.isNotEmpty) {
      AppShell._navCache = widget.navDestinations;
    }
    _navItems = widget.navDestinations.isNotEmpty
        ? widget.navDestinations
        : AppShell._navCache;
    if (_navItems.isEmpty && _railVisible) _railVisible = false;
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isWide = width >= _wideBreakpoint;

    final navItems = _navItems;

    final auth = Get.isRegistered<AuthService>() ? Get.find<AuthService>() : null;

    final userMenu = widget.showUserMenu && auth != null
        ? _UserMenu(auth: auth)
        : const SizedBox.shrink();

    final List<Widget> appBarActions = [
      ...(widget.actions ?? const []),
      if (widget.showUserMenu) userMenu,
    ];

    Widget? leading;
    if (!isWide && navItems.isNotEmpty) {
      leading = Builder(
        builder: (ctx) => IconButton(
          icon: const Icon(Icons.menu),
          onPressed: () => Scaffold.of(ctx).openDrawer(),
          tooltip: 'Menu',
        ),
      );
    }

    final titleRow = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (isWide && navItems.isNotEmpty) ...[
          IconButton(
            icon: Icon(_railVisible ? Icons.menu_open : Icons.menu),
            onPressed: () => setState(() => _railVisible = !_railVisible),
            tooltip: _railVisible ? 'Hide navigation' : 'Show navigation',
          ),
          const SizedBox(width: 8),
        ],
        Text(widget.title),
      ],
    );

    final appBar = AppBar(
      automaticallyImplyLeading: false,
      title: titleRow,
      leading: leading,
      actions: appBarActions,
    );

    ${isModule ? `if (isWide) {
      return Scaffold(
        appBar: appBar,
        body: Row(
          children: [
            if (navItems.isNotEmpty && _railVisible)
              NavigationRail(
                minWidth: 72.0,
                extended: true,
                selectedIndex: 0,
                onDestinationSelected: (i) => _go(navItems[i].route),
                labelType: NavigationRailLabelType.none,
                destinations: navItems
                    .map((d) => NavigationRailDestination(
                          icon: Icon(d.icon),
                          selectedIcon: d.selectedIcon != null ? Icon(d.selectedIcon) : null,
                          label: Text(d.label),
                        ))
                    .toList(),
              ),
            if (navItems.isNotEmpty && _railVisible)
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
      drawer: navItems.isEmpty ? null : Drawer(
        width: 360,
        child: SafeArea(
          child: ListView.builder(
            itemCount: navItems.length + 1,
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
              final d = navItems[i];
              return ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 6),
                leading: Icon(d.icon),
                title: Text(d.label),
                onTap: () {
                  Navigator.of(context).maybePop();
                  _go(d.route);
                },
              );
            },
          ),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: widget.bodyPadding,
          child: widget.body,
        ),
      ),
      floatingActionButton: widget.floatingActionButton,
    );` : `final navigationSidebar = NavigationSidebar(
      destinations: navItems,
      extended: true,
      showDrawerHeader: true,
    );

    if (isWide) {
      return Scaffold(
        appBar: appBar,
        body: Row(
          children: [
            if (navItems.isNotEmpty && _railVisible)
              SizedBox(
                width: 280, // Constrain rail width
                child: navigationSidebar,
              ),
            if (navItems.isNotEmpty && _railVisible)
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
      drawer: navItems.isEmpty ? null : navigationSidebar,
      body: SafeArea(
        child: Padding(
          padding: widget.bodyPadding,
          child: widget.body,
        ),
      ),
      floatingActionButton: widget.floatingActionButton,
    );`}
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
