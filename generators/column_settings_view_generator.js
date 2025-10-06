const { navDestinationsString } = require('./helpers/nav_destinations');

function generateColumnSettingsViewTemplate(navRoutes = []) {
  const navItems = navDestinationsString(navRoutes);

  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/app_shell.dart';
import '../../core/routes.dart';
import '../../core/preferences/column_preferences.dart';

class ColumnSettingsView extends StatelessWidget {
  const ColumnSettingsView({super.key});

  String get _title => 'Column Settings';

  @override
  Widget build(BuildContext context) {
    final prefs = Get.find<ColumnPreferencesService>();
    return AppShell(
      title: _title,
      navDestinations: const [
${navItems}
      ],
      body: Obx(() {
        final registry = prefs.registry;
        if (registry.isEmpty) {
          return Center(child: Text('No tables registered yet'.tr));
        }
        final tableKeys = registry.keys.toList()
          ..sort((a, b) => prefs.tableLabel(a).compareTo(prefs.tableLabel(b)));

        return DefaultTabController(
          length: tableKeys.length,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: TabBar(
                  isScrollable: true,
                  labelPadding: const EdgeInsets.symmetric(horizontal: 16),
                  tabs: tableKeys
                      .map((key) => Tab(text: prefs.tableLabel(key)))
                      .toList(),
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: TabBarView(
                  children: tableKeys.map((key) {
                    return Obx(() {
                      final columns = prefs.orderedDefinitions(key);
                      if (columns.isEmpty) {
                        return Center(child: Text('No columns available'.tr));
                      }
                      final orderFields = columns.map((c) => c.field).toList();
                      return ReorderableListView.builder(
                        key: PageStorageKey<String>('column-settings-' + key),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        buildDefaultDragHandles: false,
                        itemCount: columns.length,
                        onReorder: (oldIndex, newIndex) {
                          if (newIndex > oldIndex) newIndex -= 1;
                          final updated = List<String>.from(orderFields);
                          final moved = updated.removeAt(oldIndex);
                          updated.insert(newIndex, moved);
                          prefs.setColumnOrder(key, updated);
                        },
                        itemBuilder: (context, columnIndex) {
                          final column = columns[columnIndex];
                          return Container(
                            key: ValueKey(key + '_' + column.field),
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.4),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Obx(() {
                              final visible = prefs.isVisible(key, column.field);
                              return SwitchListTile(
                                controlAffinity: ListTileControlAffinity.trailing,
                                secondary: ReorderableDragStartListener(
                                  index: columnIndex,
                                  child: const Icon(Icons.drag_indicator),
                                ),
                                title: Text(column.label),
                                subtitle: column.isAudit ? Text('Audit field'.tr) : null,
                                value: visible,
                                onChanged: (value) => prefs.setColumnVisible(key, column.field, value),
                              );
                            }),
                          );
                        },
                      );
                    });
                  }).toList(),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}
`;
}

module.exports = { generateColumnSettingsViewTemplate };
