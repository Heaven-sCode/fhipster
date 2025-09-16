import 'dart:async';

import 'package:get/get.dart';

import '../connectivity/connectivity_service.dart';
import '../env/env.dart';
import '../../services/properties_service.dart';
import '../../services/media_assets_service.dart';
import '../local/dao/properties_dao.dart';
import '../local/dao/media_assets_dao.dart';


/// Periodically runs background sync tasks when the device is online.
/// Handles pushing local dirty records and refreshing the local cache.
class SyncService extends GetxService {
  SyncService({ConnectivityService? connectivity})
      : _connectivity = connectivity ?? Get.find<ConnectivityService>();

  final ConnectivityService _connectivity;
  Timer? _timer;

  PropertiesDao? _propertiesDao;
  MediaAssetsDao? _mediaAssetsDao;

  Duration get _interval => Env.get().syncInterval;

  @override
  void onInit() {
    super.onInit();
    _schedule();
    ever<bool>(_connectivity.isOnline, (online) {
      if (online) {
        _performSync();
        _resetTimer();
      }
    });
  }

  void _schedule() {
    _timer?.cancel();
    _timer = Timer.periodic(_interval, (_) async {
      if (_connectivity.isOnline.value) {
        await _performSync();
      }
    });
  }

  void _resetTimer() {
    _timer?.cancel();
    _schedule();
  }

  Future<void> _performSync() async {
    await _syncProperties();
    await _syncMediaAssets();
  }


  Future<void> _syncProperties() async {
    if (!Get.isRegistered<PropertiesService>()) Get.put(PropertiesService());
    final service = Get.find<PropertiesService>();
    final dao = _propertiesDao ??= PropertiesDao();
    try {
      final dirtyItems = await dao.getDirty();
      for (final local in dirtyItems) {
        try {
          if (local.id != null) {
            final updated = await service.update(local);
            await dao.upsert(updated, remoteId: updated.id?.toString(), updatedAt: DateTime.now().toIso8601String(), markDirty: false);
          } else {
            final created = await service.create(local);
            await dao.upsert(created, remoteId: created.id?.toString(), updatedAt: DateTime.now().toIso8601String(), markDirty: false);
          }
        } catch (e, st) {
          // ignore: avoid_print
          print('Failed to push dirty Properties: $e');
          // ignore: avoid_print
          print(st);
        }
      }

      final remoteItems = await service.list();
      for (final item in remoteItems) {
        await dao.upsert(item, remoteId: item.id?.toString(), updatedAt: DateTime.now().toIso8601String(), markDirty: false);
      }
    } catch (e, st) {
      // ignore: avoid_print
      print('Failed to sync Properties: $e');
      // ignore: avoid_print
      print(st);
    }
  }

  Future<void> _syncMediaAssets() async {
    if (!Get.isRegistered<MediaAssetsService>()) Get.put(MediaAssetsService());
    final service = Get.find<MediaAssetsService>();
    final dao = _mediaAssetsDao ??= MediaAssetsDao();
    try {
      final dirtyItems = await dao.getDirty();
      for (final local in dirtyItems) {
        try {
          if (local.id != null) {
            final updated = await service.update(local);
            await dao.upsert(updated, remoteId: updated.id?.toString(), updatedAt: DateTime.now().toIso8601String(), markDirty: false);
          } else {
            final created = await service.create(local);
            await dao.upsert(created, remoteId: created.id?.toString(), updatedAt: DateTime.now().toIso8601String(), markDirty: false);
          }
        } catch (e, st) {
          // ignore: avoid_print
          print('Failed to push dirty MediaAssets: $e');
          // ignore: avoid_print
          print(st);
        }
      }

      final remoteItems = await service.list();
      for (final item in remoteItems) {
        await dao.upsert(item, remoteId: item.id?.toString(), updatedAt: DateTime.now().toIso8601String(), markDirty: false);
      }
    } catch (e, st) {
      // ignore: avoid_print
      print('Failed to sync MediaAssets: $e');
      // ignore: avoid_print
      print(st);
    }
  }

  @override
  void onClose() {
    _timer?.cancel();
    super.onClose();
  }
}
