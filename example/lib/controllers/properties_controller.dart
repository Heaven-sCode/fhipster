import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/env/env.dart';
import '../core/sync/sync_service.dart';
import '../models/properties_model.dart';
import '../services/properties_service.dart';
import '../models/mediaAssets_model.dart';
import '../services/mediaAssets_service.dart';


/// Controller for Properties list & form state.
class PropertiesController extends GetxController {
  // ===== List state =====
  final RxList<PropertiesModel> items = <PropertiesModel>[].obs;
  final RxBool isLoading = false.obs;

  final RxInt page = 0.obs;
  final RxInt size = 0.obs;
  final RxInt total = 0.obs;
  final RxList<String> sort = <String>[].obs;

  final RxString query = ''.obs;
  Worker? _searchDebounce;

  // ===== Form state =====
  final Rx<PropertiesModel?> _editing = Rx<PropertiesModel?>(null);

  final TextEditingController titleCtrl = TextEditingController();
  final TextEditingController areaCtrl = TextEditingController();
  final TextEditingController valueCtrl = TextEditingController();
  final TextEditingController facilitiesCtrl = TextEditingController();


  final RxList<MediaAssetsModel> mediaAssets = <MediaAssetsModel>[].obs;
  final RxList<MediaAssetsModel> mediaAssetsOptions = <MediaAssetsModel>[].obs;
  final RxBool mediaAssetsLoading = false.obs;

  PropertiesService get _service {
    if (!Get.isRegistered<PropertiesService>()) Get.put(PropertiesService());
    return Get.find<PropertiesService>();
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

    loadMediaAssetsOptions();

    loadPage(0);
    if (Get.isRegistered<SyncService>()) {
      Get.find<SyncService>().syncNow().catchError((_) {});
    }

  }

  @override
  void onClose() {
    _searchDebounce?.dispose();
    titleCtrl.dispose();
    areaCtrl.dispose();
    valueCtrl.dispose();
    facilitiesCtrl.dispose();
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
      _error('Failed to load Properties list', e);
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

  void beginEdit(PropertiesModel m) {
    _editing.value = m;
    _fillForm(m);
  }

  Future<void> submitForm() async {
    final model = _buildModelFromForm();
    try {
      if (_editing.value?.id == null) {
        final created = await _service.create(model);
        _editing.value = created;
        _info('Properties created');
      } else {
        final updated = await _service.update(model);
        _editing.value = updated;
        _info('Properties updated');
      }
      await loadPage(page.value);
    } catch (e) {
      _error('Failed to save Properties', e);
    }
  }

  Future<void> deleteOne(PropertiesModel m) async {
    try {
      await _service.delete(m.id);
      _info('Properties deleted');
      await loadPage(page.value);
    } catch (e) {
      _error('Failed to delete Properties', e);
    }
  }

  // ===== Relation options loaders =====


  Future<void> loadMediaAssetsOptions() async {
    if (!Get.isRegistered<MediaAssetsService>()) Get.put(MediaAssetsService());
    final svc = Get.find<MediaAssetsService>();
    try {
      mediaAssetsLoading.value = true;
      final res = await svc.listPaged(page: 0, size: 1000, sort: ['id,asc']);
      mediaAssetsOptions.assignAll(res.items);
    } catch (e) {
      _error('Failed to load mediaAssets options', e);
    } finally {
      mediaAssetsLoading.value = false;
    }
  }

  // ===== Internals =====

  void _fillForm(PropertiesModel? m) {
    titleCtrl.text = m?.title?.toString() ?? '';
    areaCtrl.text = m?.area?.toString() ?? '';
    valueCtrl.text = m?.value?.toString() ?? '';
    facilitiesCtrl.text = m?.facilities?.toString() ?? '';

    mediaAssets.assignAll(m?.mediaAssets ?? const []);
  }

  void _clearForm() {
    titleCtrl.clear();
    areaCtrl.clear();
    valueCtrl.clear();
    facilitiesCtrl.clear();

    mediaAssets.clear();
  }

  PropertiesModel _buildModelFromForm() {
    return PropertiesModel(
      id: _editing.value?.id,
      title: titleCtrl.text.isEmpty ? null : titleCtrl.text,
      area: double.tryParse(areaCtrl.text),
      value: valueCtrl.text.isEmpty ? null : valueCtrl.text,
      facilities: facilitiesCtrl.text.isEmpty ? null : facilitiesCtrl.text,
      mediaAssets: mediaAssets.toList(),
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
