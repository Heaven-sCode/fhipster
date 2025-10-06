import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:responsive_grid/responsive_grid.dart';
import '../widgets/fhipster_input_field.dart';
import '../controllers/media_assets_controller.dart';
import '../models/media_assets_model.dart';
import '../models/properties_model.dart';


/// MediaAssets form widget. Stateless GetView bound to MediaAssetsController.
class MediaAssetsForm extends GetView<MediaAssetsController> {
  MediaAssetsForm({super.key});

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
              controller: controller.imageCtrl,
              label: 'Image'.tr,
              hint: 'Enter Image'.tr,
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
                    child: Obx(() {
              final loading = controller.propertiesLoading.value;
              final options = controller.propertiesOptions;
              return DropdownButtonFormField<PropertiesModel>(
                value: controller.properties.value,
                items: options.map((e) => DropdownMenuItem<PropertiesModel>(
                  value: e,
                  child: Text((e.id ?? '').toString()),
                )).toList(),
                onChanged: loading ? null : (v) => controller.properties.value = v,
                decoration: InputDecoration(
                  labelText: 'Properties'.tr,
                  suffixIcon: loading ? const Padding(
                    padding: EdgeInsets.all(8.0),
                    child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                  ) : IconButton(
                    tooltip: 'Reload'.tr,
                    icon: const Icon(Icons.refresh),
                    onPressed: () => controller.loadPropertiesOptions(),
                  ),
                ),
                validator: null,
              );
            }),
                  ),
                )
              ],
            ),
            const SizedBox(height: 20),
            Obx(() {
              final saving = controller.isSaving.value;
              return Row(
                children: [
                  FilledButton.icon(
                    onPressed: saving
                        ? null
                        : () async {
                            if (_formKey.currentState?.validate() ?? false) {
                              final ok = await controller.submitForm();
                              if (ok && (Get.isDialogOpen ?? false)) {
                                Get.back<bool>(result: true);
                              }
                            }
                          },
                    icon: saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.save),
                    label: Text(saving ? 'Saving'.tr : 'Save'.tr),
                  ),
                  const SizedBox(width: 12),
                  OutlinedButton.icon(
                    onPressed: saving ? null : () => controller.beginCreate(),
                    icon: const Icon(Icons.refresh),
                    label: Text('Reset'.tr),
                  ),
                ],
              );
            }),
          ],
        ),
      ),
    );
  }
}
