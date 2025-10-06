import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/env/env.dart';
import '../core/sync/sync_service.dart';
import '../models/properties_model.dart';
import '../services/properties_service.dart';
import '../models/media_assets_model.dart';
import '../services/media_assets_service.dart';


/// Controller for Properties list & form state.
class PropertiesController extends GetxController {
  // ===== List state =====
  final RxList<PropertiesModel> items = <PropertiesModel>[].obs;
  final RxBool isLoading = false.obs;
  final RxBool isSaving = false.obs;
  static bool _searchSupported = true;

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


  final RxList<MediaAssetsModel> selectedMediaAssets = <MediaAssetsModel>[].obs;
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

      var loadedViaSearch = false;
      final trimmedQuery = (query.value).trim();
      if (_searchSupported && trimmedQuery.isNotEmpty) {
        try {
          final wildcardQuery = _wildcardQuery(trimmedQuery);
          final res = await _service.search(
            query: wildcardQuery,
            page: page.value,
            size: size.value,
            sort: sort.toList(),
          );
          items.assignAll(res.items);
          total.value = res.total ?? res.items.length;
          loadedViaSearch = true;
        } catch (e) {
          final message = e.toString().toLowerCase();
          final isNotFound = message.contains('http 404') || message.contains('not found');
          if (!isNotFound) {
            rethrow;
          }
          // mark search as unsupported so we stop hitting the missing endpoint
          _searchSupported = false;
          // fall through to standard list load when search endpoint is unavailable
        }
      }

      if (!loadedViaSearch) {
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

  String _wildcardQuery(String raw) {
    final term = raw.trim();
    if (term.isEmpty) return term;
    final normalized = term.replaceAll('*', '');
    if (normalized.isEmpty) return '*';
    return '*$normalized*';
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

  void duplicateFrom(PropertiesModel source) {
    _editing.value = null;
    _clearForm();
    _fillForm(source.copyWith(id: null));
  }

  Future<bool> submitForm() async {
    final model = _buildModelFromForm();
    try {
      isSaving.value = true;
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
      return true;
    } catch (e) {
      _error('Failed to save Properties', e);
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  Future<void> deleteOne(PropertiesModel m) async {
    try {
      isSaving.value = true;
      await _service.delete(m.id);
      _info('Properties deleted');
      await loadPage(page.value);
    } catch (e) {
      _error('Failed to delete Properties', e);
    } finally {
      isSaving.value = false;
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

    selectedMediaAssets.assignAll(m?.mediaAssets ?? const []);
  }

  void _clearForm() {
    titleCtrl.clear();
    areaCtrl.clear();
    valueCtrl.clear();
    facilitiesCtrl.clear();

    selectedMediaAssets.clear();
  }

  PropertiesModel _buildModelFromForm() {
    return PropertiesModel(
      id: _editing.value?.id,
      title: titleCtrl.text.isEmpty ? null : titleCtrl.text,
      area: double.tryParse(areaCtrl.text),
      value: valueCtrl.text.isEmpty ? null : valueCtrl.text,
      facilities: facilitiesCtrl.text.isEmpty ? null : facilitiesCtrl.text,
      mediaAssets: selectedMediaAssets.toList(),
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
