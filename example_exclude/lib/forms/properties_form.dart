import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:responsive_grid/responsive_grid.dart';
import '../widgets/fhipster_input_field.dart';
import '../controllers/properties_controller.dart';
import '../models/properties_model.dart';
import '../models/media_assets_model.dart';


/// Properties form widget. Stateless GetView bound to PropertiesController.
class PropertiesForm extends GetView<PropertiesController> {
  PropertiesForm({super.key});

  final _formKey = GlobalKey<FormState>();

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ResponsiveGridRow(
              children: [

                ResponsiveGridCol(
                  lg: 4,
                  md: 6,
                  xs: 12,
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: FHipsterInputField(
              controller: controller.titleCtrl,
              label: 'Title'.tr,
              hint: 'Enter Title'.tr,
              validator: null,
            ),
                  ),
                ),

                ResponsiveGridCol(
                  lg: 4,
                  md: 6,
                  xs: 12,
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: FHipsterInputField(
              controller: controller.areaCtrl,
              label: 'Area'.tr,
              hint: 'Enter Area'.tr,
              keyboardType: TextInputType.number,
              validator: (v) {
                
                if (v != null && v.isNotEmpty) {
                  if (double.tryParse(v) == null) {
                    return 'Please enter a valid number'.tr;
                  }
                }
                return null;
              },
            ),
                  ),
                ),

                ResponsiveGridCol(
                  lg: 4,
                  md: 6,
                  xs: 12,
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: FHipsterInputField(
              controller: controller.valueCtrl,
              label: 'Value'.tr,
              hint: 'Enter Value'.tr,
              validator: null,
            ),
                  ),
                ),

                ResponsiveGridCol(
                  lg: 4,
                  md: 6,
                  xs: 12,
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: FHipsterInputField(
              controller: controller.facilitiesCtrl,
              label: 'Facilities'.tr,
              hint: 'Enter Facilities'.tr,
              validator: null,
            ),
                  ),
                ),

                ResponsiveGridCol(
                  lg: 4,
                  md: 6,
                  xs: 12,
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: Obx(() {
              final loading = controller.mediaAssetsLoading.value;
              final options = controller.mediaAssetsOptions;
              final selected = controller.mediaAssets;
              if (loading) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 8.0),
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: Text('Media Assets'.tr, style: Theme.of(Get.context!).textTheme.bodyMedium),
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: options.map((e) {
                      final isSel = selected.any((x) => x.id == e.id);
                      return FilterChip(
                        label: Text((e.id ?? '').toString()),
                        selected: isSel,
                        onSelected: (v) {
                          if (v && !isSel) {
                            selected.add(e);
                          } else if (!v && isSel) {
                            selected.removeWhere((x) => x.id == e.id);
                          }
                        },
                      );
                    }).toList(),
                  ),
                  
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      tooltip: 'Reload'.tr,
                      icon: const Icon(Icons.refresh),
                      onPressed: () => controller.loadMediaAssetsOptions(),
                    ),
                  ),
                ],
              );
            }),
                  ),
                )
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                FilledButton.icon(
                  onPressed: () {
                    if (_formKey.currentState?.validate() ?? false) {
                      controller.submitForm();
                    }
                  },
                  icon: const Icon(Icons.save),
                  label: Text('Save'.tr),
                ),
                const SizedBox(width: 12),
                OutlinedButton.icon(
                  onPressed: () => controller.beginCreate(), // reset as "new"
                  icon: const Icon(Icons.refresh),
                  label: Text('Reset'.tr),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
