import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/env/env.dart';
import '../models/mediaAssets_model.dart';
import '../services/mediaAssets_service.dart';
import '../models/properties_model.dart';
import '../services/properties_service.dart';


/// Controller for MediaAssets list & form state.
class MediaAssetsController extends GetxController {
  // ===== List state =====
  final RxList<MediaAssetsModel> items = <MediaAssetsModel>[].obs;
  final RxBool isLoading = false.obs;

  final RxInt page = 0.obs;
  final RxInt size = 0.obs;
  final RxInt total = 0.obs;
  final RxList<String> sort = <String>[].obs;

  final RxString query = ''.obs;
  Worker? _searchDebounce;

  // ===== Form state =====
  final Rx<MediaAssetsModel?> _editing = Rx<MediaAssetsModel?>(null);

  final TextEditingController imageCtrl = TextEditingController();
  final TextEditingController titleCtrl = TextEditingController();

  final Rx<PropertiesModel?> properties = Rx<PropertiesModel?>(null);
  final RxList<PropertiesModel> propertiesOptions = <PropertiesModel>[].obs;
  final RxBool propertiesLoading = false.obs;


  MediaAssetsService get _service {
    if (!Get.isRegistered<MediaAssetsService>()) Get.put(MediaAssetsService());
    return Get.find<MediaAssetsService>();
  }

  @override
  void onInit() {
    super.onInit();
    size.value = Env.get().defaultPageSize;
    sort.assignAll(Env.get().defaultSort);

    _searchDebounce = debounce(query, (_) {
      loadPage(0);
    }, time: const Duration(milliseconds: 350));

    // Eagerly load relation options (optional; comment out for lazy)
    loadPropertiesOptions();


    loadPage(0);
  }

  @override
  void onClose() {
    _searchDebounce?.dispose();
    imageCtrl.dispose();
    titleCtrl.dispose();
    super.onClose();
  }

  // ===== List / Search =====

  Future<void> loadPage(int p) async {
    try {
      isLoading.value = true;
      page.value = p;

      if ((query.value).trim().isNotEmpty) {
        final res = await _service.search(
          query: query.value.trim(),
          page: page.value,
          size: size.value,
          sort: Env.get().defaultSearchSort,
        );
        items.assignAll(res.items);
        total.value = res.total ?? res.items.length;
      } else {
        final res = await _service.listPaged(
          page: page.value,
          size: size.value,
          sort: sort.toList(),
        );
        items.assignAll(res.items);
        total.value = res.total ?? res.items.length;
      }
    } catch (e) {
      _error('Failed to load MediaAssets list', e);
    } finally {
      isLoading.value = false;
    }
  }

  void applySearch(String text) {
    query.value = text;
  }

  void changePageSize(int newSize) {
    size.value = newSize;
    loadPage(0);
  }

  void changeSort(List<String> newSort) {
    sort.assignAll(newSort);
    loadPage(0);
  }

  // ===== Form flow =====

  void beginCreate() {
    _editing.value = null;
    _clearForm();
  }

  void beginEdit(MediaAssetsModel m) {
    _editing.value = m;
    _fillForm(m);
  }

  Future<void> submitForm() async {
    final model = _buildModelFromForm();
    try {
      if (_editing.value?.id == null) {
        final created = await _service.create(model);
        _editing.value = created;
        _info('MediaAssets created');
      } else {
        final updated = await _service.update(model);
        _editing.value = updated;
        _info('MediaAssets updated');
      }
      await loadPage(page.value);
    } catch (e) {
      _error('Failed to save MediaAssets', e);
    }
  }

  Future<void> deleteOne(MediaAssetsModel m) async {
    try {
      await _service.delete(m.id);
      _info('MediaAssets deleted');
      await loadPage(page.value);
    } catch (e) {
      _error('Failed to delete MediaAssets', e);
    }
  }

  // ===== Relation options loaders =====

  Future<void> loadPropertiesOptions() async {
    if (!Get.isRegistered<PropertiesService>()) Get.put(PropertiesService());
    final svc = Get.find<PropertiesService>();
    try {
      propertiesLoading.value = true;
      final res = await svc.listPaged(page: 0, size: 1000, sort: ['id,asc']);
      propertiesOptions.assignAll(res.items);
      final current = properties.value;
      if (current?.id != null) {
        final idx = propertiesOptions.indexWhere((e) => e.id == current.id);
        if (idx != -1) {
          properties.value = propertiesOptions[idx];
        }
      }
    } catch (e) {
      _error('Failed to load properties options', e);
    } finally {
      propertiesLoading.value = false;
    }
  }


  // ===== Internals =====

  void _fillForm(MediaAssetsModel? m) {
    imageCtrl.text = m?.image?.toString() ?? '';
    titleCtrl.text = m?.title?.toString() ?? '';
    properties.value = m?.properties;

  }

  void _clearForm() {
    imageCtrl.clear();
    titleCtrl.clear();
    properties.value = null;

  }

  MediaAssetsModel _buildModelFromForm() {
    return MediaAssetsModel(
      id: _editing.value?.id,
      image: imageCtrl.text.isEmpty ? null : imageCtrl.text,
      title: titleCtrl.text.isEmpty ? null : titleCtrl.text,
      properties: properties.value,
    );
  }

  Map<String, dynamic>? _tryParseJson(String s) {
    try { return json.decode(s) as Map<String, dynamic>; } catch (_) { return null; }
  }

  void _info(String msg) {
    if (!Get.isSnackbarOpen) {
      Get.snackbar('Success', msg, snackPosition: SnackPosition.BOTTOM, duration: const Duration(seconds: 2));
    }
  }

  void _error(String msg, Object e) {
    final detail = e.toString();
    if (!Get.isSnackbarOpen) {
      Get.snackbar('Error', '$msg\n$detail', snackPosition: SnackPosition.BOTTOM, duration: const Duration(seconds: 4));
    }
  }
}

// ------- helpers -------
String cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
