// generators/navigation_sidebar_generator.js
// Emits lib/widgets/navigation_sidebar.dart
// - Shared NavigationSidebar widget for drawer and rail
// - Highlights active screen based on current route
//
// Usage:
//   NavigationSidebar(
//     destinations: [
//       AppDestination(route: '/home', icon: Icons.home, label: 'Home'),
//       ...
//     ],
//   )

function generateNavigationSidebarTemplate() {
  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/app_shell.dart'; // for AppDestination

const _wideBreakpoint = 1000.0;
const _railMin = 72.0;

int _selectedIndex(String currentRoute, List<AppDestination> items) {
  if (items.isEmpty) return -1;
  final exact = items.indexWhere((d) => d.route == currentRoute);
  if (exact >= 0) {
    return exact;
  }
  for (int i = 0; i < items.length; i++) {
    if (currentRoute.startsWith(items[i].route)) {
      return i;
    }
  }
  return 0;
}

void _go(String route) {
  if (Get.currentRoute == route) return;
  Get.offNamedUntil(route, (r) => r.settings.name == route || r.isFirst);
}

class NavigationSidebar extends StatelessWidget {
  final List<AppDestination> destinations;
  final bool extended;
  final bool showDrawerHeader;

  const NavigationSidebar({
    super.key,
    required this.destinations,
    this.extended = true,
    this.showDrawerHeader = true,
  });

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isWide = width >= _wideBreakpoint;

    final navItems = destinations;
    final current = Get.currentRoute.isEmpty ? '/' : Get.currentRoute;
    final selectedIndex = _selectedIndex(current, navItems);

    if (isWide) {
      return _NavigationRail(
        destinations: navItems,
        selectedIndex: selectedIndex,
        onSelect: (i) => _go(navItems[i].route),
        extended: extended,
      );
    }

    return _AppDrawer(
      destinations: navItems,
      selectedIndex: selectedIndex,
      onTap: (i) => _go(navItems[i].route),
      showHeader: showDrawerHeader,
    );
  }
}

class _AppDrawer extends StatelessWidget {
  final List<AppDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onTap;
  final bool showHeader;

  const _AppDrawer({
    required this.destinations,
    required this.selectedIndex,
    required this.onTap,
    required this.showHeader,
  });

  @override
  Widget build(BuildContext context) {
    if (destinations.isEmpty) return const SizedBox.shrink();
    return Drawer(
      width: 360,
      child: SafeArea(
        child: ListView.builder(
          itemCount: destinations.length + (showHeader ? 1 : 0),
          itemBuilder: (context, index) {
            if (showHeader && index == 0) {
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
            final i = showHeader ? index - 1 : index;
            final d = destinations[i];
            final selected = i == selectedIndex;
            return ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 6),
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
  final bool extended;

  const _NavigationRail({
    required this.destinations,
    required this.selectedIndex,
    required this.onSelect,
    required this.extended,
  });

  @override
  Widget build(BuildContext context) {
    if (destinations.isEmpty) {
      return const SizedBox(width: 0, height: double.infinity);
    }
    return NavigationRail(
      minWidth: _railMin,
      extended: extended,
      selectedIndex: selectedIndex < 0 ? 0 : selectedIndex,
      onDestinationSelected: onSelect,
      labelType: extended ? NavigationRailLabelType.none : NavigationRailLabelType.selected,
      destinations: destinations
          .map((d) => NavigationRailDestination(
                icon: Icon(d.icon),
                selectedIcon: d.selectedIcon != null ? Icon(d.selectedIcon) : null,
                label: Text(d.label),
              ))
          .toList(),
    );
  }
}
`;
}

module.exports = { generateNavigationSidebarTemplate };