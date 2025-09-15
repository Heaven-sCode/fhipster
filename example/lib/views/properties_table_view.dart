import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/app_shell.dart';
import '../core/env/env.dart';
import '../controllers/properties_controller.dart';
import '../models/properties_model.dart';
import '../forms/properties_form.dart';
import '../widgets/common/confirm_dialog.dart';
import '../controllers/media_assets_controller.dart';
import '../forms/media_assets_form.dart';


class PropertiesTableView extends GetView<PropertiesController> {
  const PropertiesTableView({super.key});

  String get _title => 'Properties';

  @override
  Widget build(BuildContext context) {
    final env = Env.get();

    return AppShell(
      title: _title,
      body: Obx(() {
        final items = controller.items;
        final isLoading = controller.isLoading.value;
        final total = controller.total.value;
        final page = controller.page.value;
        final size = controller.size.value;

        return Column(
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
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Obx(() {
                          final rows = controller.items;
                          return DataTable(
                            headingRowHeight: 42,
                            dataRowMinHeight: 40,
                            dataRowMaxHeight: 56,
                            columns: const [
        const DataColumn(label: Text('Id')),
        const DataColumn(label: Text('Title')),
        const DataColumn(label: Text('Area')),
        const DataColumn(label: Text('Value')),
        const DataColumn(label: Text('Facilities')),
        const DataColumn(label: Text('Media Assets')),
                              DataColumn(label: Text('Actions')),
                            ],
                            rows: rows.map((m) => DataRow(
                              cells: [
          DataCell(Text(m.id == null ? '' : m.id.toString())),
          DataCell(Text(m.title == null ? '' : m.title.toString())),
          DataCell(Text(m.area == null ? '' : m.area.toString())),
          DataCell(Text(m.value == null ? '' : m.value.toString())),
          DataCell(Text(m.facilities == null ? '' : m.facilities.toString())),
          DataCell(Text(((m.mediaAssets?.length) ?? 0).toString())),
                                DataCell(Row(
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
                                        final ok = await confirmDialog(context, title: 'Delete', message: 'Are you sure?'.tr);
                                        if (ok) {
                                          await controller.deleteOne(m);
                                        }
                                      },
                                    ),
                                  ],
                                )),
                              ],
                            )).toList(),
                          );
                        }),
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
        );
      }),
    );
  }

  // --------- dialogs ---------

  void _openFormDialog(BuildContext context, {required String title}) {
    _showFormDialog(context, title: title, body: PropertiesForm());
  }

  void _openChildFormDialog(BuildContext context, {required String title, required Widget body}) {
    _showFormDialog(context, title: title, body: body);
  }

  void _showFormDialog(BuildContext context, {required String title, required Widget body}) {
    Get.dialog(
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
                  onPressed: () => Get.back(),
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
              _kvWithAction('Media Assets', ((m.mediaAssets?.length) ?? 0).toString(), actionLabel: 'Create MediaAssets'.tr, onAction: () => _quickCreateMediaAssetsMediaAssets(context, m)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _quickCreateMediaAssetsMediaAssets(BuildContext context, PropertiesModel parent) {
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
      return;
    }
    if (!Get.isRegistered<MediaAssetsController>()) Get.put(MediaAssetsController());
    final ctrl = Get.find<MediaAssetsController>();
    ctrl.beginCreate();
    final existingIndex = ctrl.propertiesOptions.indexWhere((e) => e.id == parent.id);
    if (existingIndex == -1) {
      ctrl.propertiesOptions.add(parent);
      ctrl.properties.value = parent;
    } else {
      ctrl.properties.value = ctrl.propertiesOptions[existingIndex];
    }
    Get.back();
    _openChildFormDialog(
      context,
      title: 'Create MediaAssets'.tr,
      body: MediaAssetsForm(),
    );
  }

}

// Simple key-value row for view dialog
Widget _kv(String key, String value) {
  return _kvWithAction(key, value);
}

Widget _kvWithAction(String key, String value, {String? actionLabel, VoidCallback? onAction}) {
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
      ],
    ),
  );
}
