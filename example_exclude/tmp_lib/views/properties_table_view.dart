import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../core/app_shell.dart';
import '../core/env/env.dart';
import '../core/routes.dart';
import '../core/preferences/column_preferences.dart';
import '../controllers/properties_controller.dart';
import '../models/properties_model.dart';
import '../forms/properties_form.dart';
import '../widgets/common/confirm_dialog.dart';

import '../controllers/media_assets_controller.dart';
import '../forms/media_assets_form.dart';
import '../services/media_assets_service.dart';
import '../models/media_assets_model.dart';
import '../core/sync/sync_service.dart';


class PropertiesTableView extends GetView<PropertiesController> {
  const PropertiesTableView({super.key});

  static const String _tableKey = 'properties';
  static const String _tableLabel = 'Properties';
  static final List<TableColumnDefinition> _columnDefinitions = [
    TableColumnDefinition(field: 'id', label: 'Id', isAudit: false),
    TableColumnDefinition(field: 'title', label: 'Title', isAudit: false),
    TableColumnDefinition(field: 'area', label: 'Area', isAudit: false),
    TableColumnDefinition(field: 'value', label: 'Value', isAudit: false),
    TableColumnDefinition(field: 'facilities', label: 'Facilities', isAudit: false),
    TableColumnDefinition(field: 'mediaAssetsActions', label: 'Show Media Assets')
  ];
  static const Map<String, String> _fieldLabels = {
    'area': 'Area',
    'createdAt': 'Created At',
    'createdBy': 'Created By',
    'createdDate': 'Created Date',
    'createdOn': 'Created On',
    'facilities': 'Facilities',
    'id': 'Id',
    'lastModifiedBy': 'Last Modified By',
    'lastModifiedDate': 'Last Modified Date',
    'mediaAssets': 'Media Assets',
    'title': 'Title',
    'updatedAt': 'Updated At',
    'updatedBy': 'Updated By',
    'updatedDate': 'Updated Date',
    'updatedOn': 'Updated On',
    'value': 'Value',
  };
  static const Map<String, String> _mediaAssetsFieldLabels = {
    'createdAt': 'Created At',
    'createdBy': 'Created By',
    'createdDate': 'Created Date',
    'createdOn': 'Created On',
    'id': 'Id',
    'image': 'Image',
    'lastModifiedBy': 'Last Modified By',
    'lastModifiedDate': 'Last Modified Date',
    'properties': 'Properties',
    'title': 'Title',
    'updatedAt': 'Updated At',
    'updatedBy': 'Updated By',
    'updatedDate': 'Updated Date',
    'updatedOn': 'Updated On',
  };
  static bool _columnsRegistered = false;

  List<_ColumnSpec<PropertiesModel>> _buildAllColumnSpecs() {
    return [
    _ColumnSpec<PropertiesModel>(
      field: 'id',
      label: 'Id',
      isAudit: false,
      cellBuilder: (context, m) => DataCell(Text(m.id == null ? '' : m.id.toString())),
    ),
    _ColumnSpec<PropertiesModel>(
      field: 'title',
      label: 'Title',
      isAudit: false,
      cellBuilder: (context, m) => DataCell(Text(m.title == null ? '' : m.title.toString())),
    ),
    _ColumnSpec<PropertiesModel>(
      field: 'area',
      label: 'Area',
      isAudit: false,
      cellBuilder: (context, m) => DataCell(Text(m.area == null ? '' : m.area.toString())),
    ),
    _ColumnSpec<PropertiesModel>(
      field: 'value',
      label: 'Value',
      isAudit: false,
      cellBuilder: (context, m) => DataCell(Text(m.value == null ? '' : m.value.toString())),
    ),
    _ColumnSpec<PropertiesModel>(
      field: 'facilities',
      label: 'Facilities',
      isAudit: false,
      cellBuilder: (context, m) => DataCell(Text(m.facilities == null ? '' : m.facilities.toString())),
    ),
    _ColumnSpec<PropertiesModel>(
      field: 'mediaAssetsActions',
      label: 'Show Media Assets',
      cellBuilder: (context, m) => DataCell(Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FilledButton.icon(
            onPressed: () => _handleShowMediaAssetsMediaAssets(context, m),
            icon: const Icon(Icons.visibility),
            label: Text('Show Media Assets'.tr),
          ),
          const SizedBox(width: 8),
          FilledButton.icon(
            onPressed: () => _quickCreateMediaAssetsMediaAssets(context, m),
            icon: const Icon(Icons.add),
            label: Text('Add Media Assets'.tr),
          ),
        ],
      )),
    )
    ];
  }

  _ColumnSpec<PropertiesModel>? _findSpec(String field, List<_ColumnSpec<PropertiesModel>> specs) {
    for (final spec in specs) {
      if (spec.field == field) return spec;
    }
    return null;
  }

  static void registerColumns(ColumnPreferencesService prefs, {bool force = false}) {
    if (!force && _columnsRegistered) return;
    prefs.register(_tableKey, _tableLabel, _columnDefinitions);
    _columnsRegistered = true;
  }

  String get _title => 'Properties';

  @override
  Widget build(BuildContext context) {
    final env = Env.get();
    final prefs = Get.find<ColumnPreferencesService>();
    if (!_columnsRegistered) {
      if (prefs.registry.containsKey(_tableKey)) {
        _columnsRegistered = true;
      } else {
        final binding = WidgetsBinding.instance;
        if (binding != null) {
          binding.addPostFrameCallback((_) => registerColumns(prefs));
        } else {
          registerColumns(prefs);
        }
      }
    }

    return AppShell(
      title: _title,
      navDestinations: const [
        AppDestination(
          route: AppRoutes.home,
          icon: Icons.home_outlined,
          selectedIcon: Icons.home,
          label: 'Home',
        ),
        AppDestination(
          route: '/properties',
          icon: Icons.table_chart_outlined,
          selectedIcon: Icons.table_chart,
          label: 'Properties',
        ),
        AppDestination(
          route: '/media-assets',
          icon: Icons.table_chart_outlined,
          selectedIcon: Icons.table_chart,
          label: 'Media Assets',
        ),
        AppDestination(
          route: '/settings/columns',
          icon: Icons.view_column_outlined,
          selectedIcon: Icons.view_column,
          label: 'Column Settings',
        ),
      ],
      body: Obx(() {
        final items = controller.items;
        final isLoading = controller.isLoading.value;
        final total = controller.total.value;
        final page = controller.page.value;
        final size = controller.size.value;
        prefs.layouts[_tableKey];
        final layoutMode = prefs.layoutMode(_tableKey);
        prefs.hidden[_tableKey];
        var visibleDefs = prefs.visibleDefinitions(_tableKey);
        if (visibleDefs.isEmpty) {
          visibleDefs = _columnDefinitions;
        }
        final allSpecs = _buildAllColumnSpecs();
        var specs = visibleDefs
            .map((def) => _findSpec(def.field, allSpecs))
            .whereType<_ColumnSpec<PropertiesModel>>()
            .toList();
        if (specs.isEmpty) {
          specs = List<_ColumnSpec<PropertiesModel>>.from(allSpecs);
        }

        final sortEntries = controller.sort;
        String? activeSortField;
        bool isSortDescending = false;
        if (sortEntries.isNotEmpty) {
          final parts = sortEntries.first.split(',');
          if (parts.isNotEmpty) {
            activeSortField = parts.first;
          }
          if (parts.length > 1) {
            isSortDescending = parts[1].toLowerCase() == 'desc';
          }
        }

        int? sortColumnIndex;
        bool sortAscending = !isSortDescending;
        if (activeSortField != null) {
          final index = specs.indexWhere((spec) => spec.field == activeSortField);
          if (index != -1) {
            sortColumnIndex = index;
          }
        }

        return Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
            // Toolbar: search + actions
            Wrap(
              spacing: 12,
              runSpacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                // Search box
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: TextField(
                    onChanged: controller.applySearch,
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search),
                      hintText: 'Search'.tr,
                      isDense: true,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                ),
                FilledButton.icon(
                  onPressed: () {
                    controller.beginCreate();
                    _openFormDialog(context, title: 'Create Properties');
                  },
                  icon: const Icon(Icons.add),
                  label: Text('New'.tr),
                ),
                OutlinedButton.icon(
                  onPressed: isLoading ? null : () => controller.loadPage(page),
                  icon: const Icon(Icons.refresh),
                  label: Text('Refresh'.tr),
                ),
                ToggleButtons(
                  borderRadius: const BorderRadius.all(Radius.circular(8)),
                  constraints: const BoxConstraints(minHeight: 36, minWidth: 40),
                  isSelected: [
                    layoutMode == 'table',
                    layoutMode == 'cards',
                  ],
                  onPressed: (index) {
                    prefs.setLayoutMode(_tableKey, index == 0 ? 'table' : 'cards');
                  },
                  children: const [
                    Icon(Icons.table_chart),
                    Icon(Icons.view_agenda_outlined),
                  ],
                ),
                if (isLoading) const Padding(
                  padding: EdgeInsets.only(left: 8),
                  child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Table
            Expanded(
              child: Card(
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    Expanded(
                      child: layoutMode == 'table'
                          ? SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                          child: DataTable(
                                sortColumnIndex: sortColumnIndex,
                                sortAscending: sortAscending,
                                headingRowHeight: 42,
                                dataRowMinHeight: 40,
                                dataRowMaxHeight: 56,
                                columns: [
                                  for (var i = 0; i < specs.length; i++)
                                    DataColumn(
                                      label: _buildSortLabel(context, controller, specs[i].field, specs[i].label, activeSortField, isSortDescending),
                                      onSort: (_, __) => _toggleSort(controller, specs[i].field),
                                    ),
                                  DataColumn(label: Text('Actions'.tr)),
                                ],
                                rows: items.asMap().entries.map((entry) {
                                  final index = entry.key;
                                  final m = entry.value;
                                  final cells = specs
                                      .map((spec) => spec.cellBuilder(context, m))
                                      .toList();
                                  cells.add(DataCell(_buildRowActions(context, m)));
                                  return DataRow(
                                    color: index.isEven
                                        ? MaterialStateProperty.all(Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.2))
                                        : null,
                                    cells: cells,
                                  );
                                }).toList(),
                              ),
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: items.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                final model = items[index];
                                final detailTiles = <Widget>[];
                                for (final spec in specs) {
                                  final cell = spec.cellBuilder(context, model);
                                  final valueWidget = cell.child;
                                  if (_isValueWidgetEmpty(valueWidget)) continue;
                                  detailTiles.add(
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 12),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          SizedBox(
                                            width: 160,
                                            child: Text(
                                              spec.label,
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .bodyMedium
                                                  ?.copyWith(fontWeight: FontWeight.w600),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(child: valueWidget),
                                        ],
                                      ),
                                    ),
                                  );
                                }
                                return Card(
                                  elevation: 0,
                                  clipBehavior: Clip.antiAlias,
                                  color: Theme.of(context).colorScheme.secondaryContainer.withOpacity(
                                        Theme.of(context).brightness == Brightness.dark ? 0.3 : 0.7,
                                      ),
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        ...detailTiles,
                                        const SizedBox(height: 8),
                                        Align(
                                          alignment: Alignment.centerRight,
                                          child: _buildRowActions(context, model),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),

// Pagination bar
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.4),
                        border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
                      ),
                      child: Row(
                        children: [
                          Text('Rows per page:'.tr),
                          const SizedBox(width: 8),
                          DropdownButton<int>(
                            value: size,
                            items: env.pageSizeOptions
                                .map((e) => DropdownMenuItem<int>(value: e, child: Text(e.toString())))
                                .toList(),
                            onChanged: (v) {
                              if (v != null) controller.changePageSize(v);
                            },
                          ),
                          const Spacer(),
                          Obx(() {
                            final p = controller.page.value;
                            final s = controller.size.value;
                            final t = controller.total.value;
                            final start = t == 0 ? 0 : (p * s) + 1;
                            final end = ((p + 1) * s).clamp(0, t);
                            return Text('$start–$end of $t');
                          }),
                          IconButton(
                            tooltip: 'Previous'.tr,
                            icon: const Icon(Icons.chevron_left),
                            onPressed: page > 0 && !isLoading ? () => controller.loadPage(page - 1) : null,
                          ),
                          IconButton(
                            tooltip: 'Next'.tr,
                            icon: const Icon(Icons.chevron_right),
                            onPressed: ((page + 1) * size) < total && !isLoading
                                ? () => controller.loadPage(page + 1)
                                : null,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
              ],
            ),
          ],
        );
      }),
    );
  }

  // --------- dialogs ---------

  Widget _buildRowActions(BuildContext context, PropertiesModel m) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: 'View'.tr,
          icon: const Icon(Icons.visibility),
          onPressed: () => _openViewDialog(context, m),
        ),
        IconButton(
          tooltip: 'Edit'.tr,
          icon: const Icon(Icons.edit),
          onPressed: () {
            controller.beginEdit(m);
            _openFormDialog(context, title: 'Edit Properties');
          },
        ),
        IconButton(
          tooltip: 'Delete'.tr,
          icon: const Icon(Icons.delete_outline),
          onPressed: () async {
            final ok = await showConfirmDialog(
              context,
              title: 'Delete',
              message: 'Are you sure?'.tr,
            );
            if (ok == true) {
              await controller.deleteOne(m);
            }
          },
        ),
      ],
    );
  }

  Widget _buildSortLabel(BuildContext context, PropertiesController controller, String field, String label, String? activeField, bool isDescending) {
    final isActive = activeField == field;
    final theme = Theme.of(context);
    final color = isActive ? theme.colorScheme.primary : null;
    IconData icon;
    if (!isActive) {
      icon = Icons.unfold_more;
    } else {
      icon = isDescending ? Icons.arrow_downward : Icons.arrow_upward;
    }
    return InkWell(
      borderRadius: const BorderRadius.all(Radius.circular(6)),
      onTap: () => _toggleSort(controller, field),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: isActive
                ? theme.textTheme.titleSmall?.copyWith(color: color, fontWeight: FontWeight.w600)
                : theme.textTheme.titleSmall,
          ),
          const SizedBox(width: 4),
          Icon(icon, size: 16, color: color ?? theme.iconTheme.color),
        ],
      ),
    );
  }

  void _toggleSort(PropertiesController controller, String field) {
    final current = controller.sort.toList();
    final defaultSort = Env.get().defaultSort;
    if (current.isNotEmpty) {
      final first = current.first;
      final parts = first.split(',');
      final currentField = parts.isNotEmpty ? parts.first : '';
      final currentDir = parts.length > 1 ? parts[1].toLowerCase() : 'asc';

      if (currentField == field) {
        if (currentDir == 'asc') {
          controller.changeSort(['$field,desc']);
        } else {
          controller.changeSort(defaultSort.isNotEmpty ? List<String>.from(defaultSort) : <String>[]);
        }
        return;
      }
    }
    controller.changeSort(['$field,asc']);
  }

  Future<void> _openChildListDialog(
    BuildContext context, {
    required String title,
    Iterable<dynamic>? items,
    Map<String, String>? fieldLabels,
    Future<List<dynamic>> Function()? onRefresh,
    Future<bool> Function(dynamic item)? onEdit,
    Future<bool> Function(dynamic item)? onDelete,
  }) async {
    var childItems = (items ?? const <dynamic>[]).toList();
    final effectiveLabels = fieldLabels ?? _fieldLabels;

    Future<void> refreshItems(StateSetter setState) async {
      if (onRefresh == null) return;
      final updated = await onRefresh();
      if (updated != null) {
        setState(() {
          childItems = List<dynamic>.from(updated);
        });
      }
    }

    await Get.dialog(
      Dialog(
        insetPadding: const EdgeInsets.all(16),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 920, maxHeight: 720),
          child: StatefulBuilder(
            builder: (context, setState) {
              final hasItems = childItems.isNotEmpty;
              return Scaffold(
                appBar: AppBar(
                  title: Text(title),
                  automaticallyImplyLeading: false,
                  actions: [
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Get.back<void>(),
                    ),
                  ],
                ),
                body: hasItems
                    ? ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                        itemCount: childItems.length,
                        itemBuilder: (context, index) {
                          final item = childItems[index];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: _childItemCard(
                              item,
                              fieldLabels: effectiveLabels,
                              onEdit: onEdit == null
                                  ? null
                                  : (value) async {
                                      final changed = await onEdit(value);
                                      if (changed == true) {
                                        await refreshItems(setState);
                                      }
                                      return changed ?? false;
                                    },
                              onDelete: onDelete == null
                                  ? null
                                  : (value) async {
                                      final changed = await onDelete(value);
                                      if (changed == true) {
                                        await refreshItems(setState);
                                      }
                                      return changed ?? false;
                                    },
                            ),
                          );
                        },
                      )
                    : Center(child: Text('No records found'.tr)),
              );
            },
          ),
        ),
      ),
    );
  }

  Future<bool?> _openFormDialog(BuildContext context, {required String title}) {
    return _showFormDialog(context, title: title, body: PropertiesForm());
  }

  Future<bool?> _openChildFormDialog(BuildContext context, {required String title, required Widget body}) {
    return _showFormDialog(context, title: title, body: body);
  }

  Future<bool?> _showFormDialog(BuildContext context, {required String title, required Widget body}) {
    return Get.dialog(
      Dialog(
        insetPadding: const EdgeInsets.all(16),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900, maxHeight: 700),
          child: Scaffold(
            appBar: AppBar(
              title: Text(title),
              automaticallyImplyLeading: false,
              actions: [
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Get.back<void>(),
                )
              ],
            ),
            body: Padding(
              padding: const EdgeInsets.all(8.0),
              child: body,
            ),
          ),
        ),
      ),
      barrierDismissible: false,
    );
  }

  void _openViewDialog(BuildContext context, PropertiesModel m) {
    if (Get.isRegistered<SyncService>()) {
      Get.find<SyncService>().syncNow().catchError((_) {});
    }

    Get.dialog(
      Dialog(
        insetPadding: const EdgeInsets.all(16),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720, maxHeight: 640),
          child: Scaffold(
            appBar: AppBar(
              title: Text('View Properties'),
              automaticallyImplyLeading: false,
              actions: [
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Get.back(),
                )
              ],
            ),
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
              _kv('Id', m.id?.toString() ?? ''),
              _kv('Title', m.title?.toString() ?? ''),
              _kv('Area', m.area?.toString() ?? ''),
              _kv('Value', m.value?.toString() ?? ''),
              _kv('Facilities', m.facilities?.toString() ?? ''),
              _kvWithAction('Media Assets', ((m.mediaAssets?.length) ?? 0).toString(), actionLabel: 'Create MediaAssets'.tr, onAction: () => _quickCreateMediaAssetsMediaAssets(context, m), secondaryActionLabel: 'View MediaAssets'.tr, onSecondaryAction: () => _openChildListDialog(
                context,
                title: 'MediaAssets'.tr,
                items: m.mediaAssets,
                fieldLabels: _mediaAssetsFieldLabels,
                onRefresh: () => _fetchMediaAssetsMediaAssets(m),
                onEdit: (item) async {
                  if (item is MediaAssetsModel) {
                    return await _editChildMediaAssetsMediaAssets(context, m, item);
                  }
                  return false;
                },
                onDelete: (item) async {
                  if (item is MediaAssetsModel) {
                    return await _deleteChildMediaAssetsMediaAssets(context, m, item);
                  }
                  return false;
                },
              )),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<List<MediaAssetsModel>> _fetchMediaAssetsMediaAssets(PropertiesModel parent) async {
    final id = parent.id;
    if (id == null) return parent.mediaAssets ?? const [];
    if (!Get.isRegistered<MediaAssetsService>()) Get.put(MediaAssetsService());
    final svc = Get.find<MediaAssetsService>();
    try {
      return await svc.list(filters: {'propertiesId': {'equals': id}});
    } catch (e) {
      if (!Get.isSnackbarOpen) {
        Get.snackbar('Error'.tr, 'Failed to load Media Assets'.tr);
      }
      return parent.mediaAssets ?? const [];
    }
  }

  Future<void> _handleShowMediaAssetsMediaAssets(BuildContext context, PropertiesModel parent) async {
    final fetched = await _fetchMediaAssetsMediaAssets(parent);
    await _openChildListDialog(
      context,
      title: 'Media Assets'.tr,
      items: fetched,
      fieldLabels: _mediaAssetsFieldLabels,
      onRefresh: () => _fetchMediaAssetsMediaAssets(parent),
      onEdit: (item) async {
        if (item is MediaAssetsModel) {
          return await _editChildMediaAssetsMediaAssets(context, parent, item);
        }
        return false;
      },
      onDelete: (item) async {
        if (item is MediaAssetsModel) {
          return await _deleteChildMediaAssetsMediaAssets(context, parent, item);
        }
        return false;
      },
    );
  }


  PropertiesModel _ensureMediaAssetsMediaAssetsParentOption(MediaAssetsController ctrl, PropertiesModel parent) {
    final index = ctrl.propertiesOptions.indexWhere((e) => e.id == parent.id);
    if (index == -1) {
      ctrl.propertiesOptions.add(parent);
      return parent;
    }
    return ctrl.propertiesOptions[index];
  }



  Future<bool> _editChildMediaAssetsMediaAssets(BuildContext context, PropertiesModel parent, MediaAssetsModel child) async {
    if (!Get.isRegistered<MediaAssetsController>()) {
      Get.put(MediaAssetsController(), permanent: true);
    }
    final ctrl = Get.find<MediaAssetsController>();
    final parentOption = _ensureMediaAssetsMediaAssetsParentOption(ctrl, parent);
    ctrl.beginEdit(child);
    ctrl.properties.value = parentOption;
    final saved = await _openChildFormDialog(
      context,
      title: 'Edit MediaAssets'.tr,
      body: MediaAssetsForm(),
    );
    if (saved == true) {
      await ctrl.loadPage(ctrl.page.value);
      await controller.loadPage(controller.page.value);
      Get.snackbar('Success'.tr, 'Record updated'.tr, snackPosition: SnackPosition.BOTTOM, duration: const Duration(seconds: 2));
      return true;
    }
    return false;
  }

  Future<bool> _deleteChildMediaAssetsMediaAssets(BuildContext context, PropertiesModel parent, MediaAssetsModel child) async {
    if ((child.id ?? null) == null) return false;
    final ok = await showConfirmDialog(
      context,
      title: 'Delete',
      message: 'Are you sure?'.tr,
    );
    if (ok != true) return false;
    if (!Get.isRegistered<MediaAssetsController>()) {
      Get.put(MediaAssetsController(), permanent: true);
    }
    final ctrl = Get.find<MediaAssetsController>();
    await ctrl.deleteOne(child);
    await ctrl.loadPage(ctrl.page.value);
    await controller.loadPage(controller.page.value);
    return true;
  }

  Future<bool> _quickCreateMediaAssetsMediaAssets(BuildContext context, PropertiesModel parent) async {
    if ((parent.id ?? null) == null) {
      Get.snackbar(
        'Error'.tr,
        'error.saveParentFirst'.trParams({
          'parent': 'Properties',
          'child': 'Media Assets',
        }),
        snackPosition: SnackPosition.BOTTOM,
        duration: const Duration(seconds: 3),
      );
      return false;
    }
    if (!Get.isRegistered<MediaAssetsController>()) {
      Get.put(MediaAssetsController(), permanent: true);
    }
    final ctrl = Get.find<MediaAssetsController>();
    ctrl.beginCreate();
    final parentOption = _ensureMediaAssetsMediaAssetsParentOption(ctrl, parent);
    ctrl.properties.value = parentOption;
    final saved = await _openChildFormDialog(
      context,
      title: 'Create MediaAssets'.tr,
      body: MediaAssetsForm(),
    );
    if (saved == true) {
      await ctrl.loadPage(ctrl.page.value);
      await controller.loadPage(controller.page.value);
      Get.snackbar('Success'.tr, 'Record created'.tr, snackPosition: SnackPosition.BOTTOM, duration: const Duration(seconds: 2));
      return true;
    }
    return false;
  }

}

String _humanizeKeyLabel(String key) {
  if (key.isEmpty) return '';
  if (key.toLowerCase() == 'id') return 'ID';
  var label = key
      .replaceAllMapped(RegExp(r'${([^}]*)}'), (match) => match.group(1) ?? '')
      .replaceAllMapped(RegExp(r'([A-Za-z])$(d+)([A-Za-z])'), (match) {
        final before = match.group(1) ?? '';
        final token = match.group(2);
        final after = match.group(3) ?? '';
        if (token == '1' || token == '2') {
          return before + 's' + after;
        }
        return before + after;
      })
      .replaceAllMapped(RegExp(r'$([A-Za-z])'), (match) => match.group(1) ?? '')
      .replaceAllMapped(RegExp(r'$([0-9]+)'), (match) {
        final token = match.group(1);
        if (token == '1' || token == '2') {
          return 's';
        }
        return '';
      })
      .replaceAll(RegExp(r'[{}]+'), '')
      .replaceAll(RegExp(r'[._]+'), ' ');
  label = label.replaceAllMapped(RegExp(r'([a-z0-9])([A-Z])'), (match) {
    final a = match.group(1) ?? '';
    final b = match.group(2) ?? '';
    return '$a $b';
  });
  label = label.replaceAllMapped(RegExp(r'([A-Za-z])([0-9])'), (match) {
    final a = match.group(1) ?? '';
    final b = match.group(2) ?? '';
    return '$a $b';
  });
  label = label.replaceAllMapped(RegExp(r'([0-9])([A-Za-z])'), (match) {
    final a = match.group(1) ?? '';
    final b = match.group(2) ?? '';
    return '$a $b';
  });
  label = label.replaceAll(RegExp(r's+'), ' ').trim();
  if (label.isEmpty) return _humanizeEnumToken(key);
  return label
      .split(RegExp(r's+'))
      .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1).toLowerCase())
      .join(' ');
}

Widget _childItemCard(
  dynamic item, {
  required Map<String, String> fieldLabels,
  Future<bool> Function(dynamic item)? onEdit,
  Future<bool> Function(dynamic item)? onDelete,
}) {
  if (item == null) {
    return const SizedBox.shrink();
  }

  Map<String, dynamic>? data;
  if (item is Map<String, dynamic>) {
    data = Map<String, dynamic>.from(item);
  } else {
    try {
      final dynamic json = (item as dynamic).toJson?.call();
      if (json is Map<String, dynamic>) {
        data = Map<String, dynamic>.from(json);
      }
    } catch (_) {
      data = null;
    }
  }

  data ??= {'Value': item};

  final entries = data.entries
      .where((entry) {
        final value = entry.value;
        if (value == null) return false;
        if (value is Map || value is Iterable) return false;
        final str = value is DateTime ? _formatTemporal(value) : value.toString();
        return str.isNotEmpty;
      })
      .take(8)
      .toList();

  if (entries.isEmpty) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: SelectableText(item.toString()),
      ),
    );
  }

  final theme = Theme.of(Get.context!);
  final cardColor = theme.colorScheme.surfaceVariant.withOpacity(theme.brightness == Brightness.dark ? 0.25 : 0.7);
  final titleEntry = entries.firstWhere(
    (e) {
      final key = e.key.toLowerCase();
      return key == 'title' || key == 'name' || key == 'displayname';
    },
    orElse: () => MapEntry('', ''),
  );

  return Card(
    elevation: 3,
    color: cardColor,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (titleEntry.key.isNotEmpty) ...[
            Text(
              titleEntry.value is DateTime ? _formatTemporal(titleEntry.value) : titleEntry.value.toString(),
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
          ],
          ...entries.where((entry) => entry.key != titleEntry.key).map<Widget>((entry) {
            final value = entry.value is DateTime ? _formatTemporal(entry.value) : entry.value.toString();
            final label = fieldLabels[entry.key] ?? _humanizeKeyLabel(entry.key);
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 160,
                    child: Text(
                      (label.isEmpty ? entry.key : label),
                      style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: SelectableText(
                      value,
                      style: theme.textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
            );
          }),
          if (onEdit != null || onDelete != null) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              children: [
                if (onEdit != null)
                  FilledButton.tonalIcon(
                    onPressed: () async => await onEdit(item),
                    icon: const Icon(Icons.edit),
                    label: Text('Edit'.tr),
                  ),
                if (onDelete != null)
                  OutlinedButton.icon(
                    onPressed: () async => await onDelete(item),
                    icon: const Icon(Icons.delete_outline),
                    label: Text('Delete'.tr),
                  ),
              ],
            ),
          ],
        ],
      ),
    ),
  );
}

bool _isValueWidgetEmpty(Widget? widget) {
  if (widget == null) return true;

  if (widget is Text) {
    final data = widget.data;
    if (data != null && data.trim().isEmpty) return true;
  } else if (widget is SelectableText) {
    final data = widget.data;
    if (data != null && data.trim().isEmpty) return true;
  } else if (widget is SizedBox) {
    final child = widget.child;
    if (child != null) {
      return _isValueWidgetEmpty(child);
    }
    if ((widget.height ?? 0) == 0 && (widget.width ?? 0) == 0) {
      return true;
    }
  } else if (widget is Padding) {
    return _isValueWidgetEmpty(widget.child);
  }
  return false;
}

// Simple key-value row for view dialog
Widget _kv(String key, String value) {
  return _kvWithAction(key, value);
}

Widget _kvWithAction(
  String key,
  String value, {
  String? actionLabel,
  VoidCallback? onAction,
  String? secondaryActionLabel,
  VoidCallback? onSecondaryAction,
}) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 200,
          child: Text(key, style: Get.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: SelectableText(value),
        ),
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(width: 16),
          FilledButton.icon(
            onPressed: onAction,
            icon: const Icon(Icons.add),
            label: Text(actionLabel),
          ),
        ],
        if (secondaryActionLabel != null && onSecondaryAction != null) ...[
          const SizedBox(width: 16),
          FilledButton.icon(
            onPressed: onSecondaryAction,
            icon: const Icon(Icons.visibility),
            label: Text(secondaryActionLabel),
          ),
        ],
      ],
    ),
  );
}

String _formatTemporal(dynamic value) {
  if (value == null) return '';
  return value.toString();
}

const Map<String, String> _enumTokenLabels = {};

String _enumLabel(Object? value) {
  if (value == null) return '';

  if (value is Enum) {
    final token = value.toString().split('.').last;
    return _enumTokenLabels[token] ?? _humanizeEnumToken(token);
  }
  final raw = value.toString();
  final token = raw.contains('.') ? raw.split('.').last : raw;
  return _enumTokenLabels[token] ?? _humanizeEnumToken(token);
}

class _ColumnSpec<T> {
  final String field;
  final String label;
  final bool isAudit;
  final DataCell Function(BuildContext context, T model) cellBuilder;

  _ColumnSpec({
    required this.field,
    required this.label,
    required this.cellBuilder,
    this.isAudit = false,
  });

  TableColumnDefinition get definition => TableColumnDefinition(
        field: field,
        label: label,
        isAudit: isAudit,
      );
}

String _humanizeEnumToken(String token) {
  if (token.isEmpty) return '';
  final spaced = token
      .replaceAll(RegExp(r'([a-z0-9])([A-Z])'), r'$1 $2')
      .replaceAll(RegExp(r'[_-]+'), ' ')
      .trim();
  if (spaced.isEmpty) return '';
  final parts = spaced.split(RegExp('\\s+'));
  return parts
      .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1).toLowerCase())
      .join(' ');
}
