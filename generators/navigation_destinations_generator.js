// generators/navigation_destinations_generator.js
// Emits lib/core/navigation_destinations.dart
// - Global list of navigation destinations for all entities
//
// Usage: generateNavigationDestinationsTemplate(navRoutes)

function generateNavigationDestinationsTemplate(navRoutes) {
  const destinations = navRoutes.map(route => `
    AppDestination(
      route: '${route.path}',
      icon: Icons.table_chart_outlined,
      selectedIcon: Icons.table_chart,
      label: '${route.label}',
    ),`).join('');

  return `import 'package:flutter/material.dart';
import 'app_shell.dart';

const List<AppDestination> globalNavDestinations = [
  AppDestination(
    route: '/home',
    icon: Icons.home_outlined,
    selectedIcon: Icons.home,
    label: 'Home',
  ),${destinations}
];
`;
}

module.exports = { generateNavigationDestinationsTemplate };