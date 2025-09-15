import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/app_shell.dart';
import '../core/env/env.dart';
import '../controllers/mediaAssets_controller.dart';
import '../models/mediaAssets_model.dart';
import '../forms/mediaAssets_form.dart';
import '../widgets/common/confirm_dialog.dart';

class MediaAssetsTableView extends GetView<MediaAssetsController> {
  const MediaAssetsTableView({super.key});

  String get _title => 'MediaAssets';

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
                    _openFormDialog(context, title: 'Create MediaAssets');
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
        const DataColumn(label: Text('Image')),
        const DataColumn(label: Text('Title')),
        const DataColumn(label: Text('Properties')),
                              DataColumn(label: Text('Actions')),
                            ],
                            rows: rows.map((m) => DataRow(
                              cells: [
          DataCell(Text(m.id == null ? '' : m.id.toString())),
          DataCell(Text(m.image == null ? '' : m.image.toString())),
          DataCell(Text(m.title == null ? '' : m.title.toString())),
          DataCell(Text(m.properties?.id?.toString() ?? '')),
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
                                        _openFormDialog(context, title: 'Edit MediaAssets');
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
              child: MediaAssetsForm(),
            ),
          ),
        ),
      ),
      barrierDismissible: false,
    );
  }

  void _openViewDialog(BuildContext context, MediaAssetsModel m) {
    Get.dialog(
      Dialog(
        insetPadding: const EdgeInsets.all(16),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720, maxHeight: 640),
          child: Scaffold(
            appBar: AppBar(
              title: Text('View MediaAssets'),
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
              _kv('Image', m.image?.toString() ?? ''),
              _kv('Title', m.title?.toString() ?? ''),
              _kv('Properties', m.properties?.id?.toString() ?? ''),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// Simple key-value row for view dialog
Widget _kv(String key, String value) {
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
        Expanded(child: SelectableText(value)),
      ],
    ),
  );
}
