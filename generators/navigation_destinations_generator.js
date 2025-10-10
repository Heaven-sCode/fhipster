// generators/navigation_destinations_generator.js
// Emits lib/core/navigation_destinations.dart
// - Global list of navigation destinations for all entities
//
// Usage: generateNavigationDestinationsTemplate(navRoutes)

const { titleCase, toWords } = require('../utils/naming');

function normalizeLabel(label) {
  const words = toWords(label);
  if (!words.length) return label;
  return titleCase(words.join(' '));
}

function generateNavigationDestinationsTemplate(navRoutes) {
  const destinations = navRoutes.map(route => {
    const humanizedLabel = normalizeLabel(route.label || route.path.replace(/^\/+/, ''));
    return `
    AppDestination(
      route: '${route.path}',
      icon: Icons.table_chart_outlined,
      selectedIcon: Icons.table_chart,
      label: '${humanizedLabel}',
    ),`;
  }).join('');

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