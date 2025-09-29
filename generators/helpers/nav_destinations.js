const { titleCase, toWords } = require('../../utils/naming');

const HOME_ROUTE = '/home';

function normalizeLabel(label) {
  const words = toWords(label);
  if (!words.length) return label;
  return titleCase(words.join(' '));
}

function navDestinationsString(navRoutes = []) {
  const items = [];
  const seen = new Set();

  items.push(`        AppDestination(
          route: AppRoutes.home,
          icon: Icons.home_outlined,
          selectedIcon: Icons.home,
          label: 'Home',
        ),`);
  seen.add(HOME_ROUTE);

  (navRoutes || []).forEach((entry) => {
    if (!entry || !entry.path) return;
    let path = String(entry.path);
    if (!path.startsWith('/')) path = '/' + path;
    if (seen.has(path)) return;
    seen.add(path);
    const rawLabel = entry.label ? String(entry.label) : path.replace(/^\/+/, '');
    const label = normalizeLabel(rawLabel) || rawLabel;
    const icon = entry.icon || 'Icons.table_chart_outlined';
    const selectedIcon = entry.selectedIcon || 'Icons.table_chart';
    items.push(`        AppDestination(
          route: '${path}',
          icon: ${icon},
          selectedIcon: ${selectedIcon},
          label: '${label}',
        ),`);
  });

  return items.join('\n');
}

module.exports = { navDestinationsString };
