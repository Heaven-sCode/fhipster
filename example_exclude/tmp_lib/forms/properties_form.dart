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
                    child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Media Assets'.tr, style: Theme.of(Get.context!).textTheme.bodyMedium),
                const SizedBox(height: 4),
                Text(
                  'Linked records are managed from the media assets view.',
                  style: Theme.of(Get.context!).textTheme.bodySmall,
                ),
              ],
            ),
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
