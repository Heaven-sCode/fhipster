import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';

/// Tracks network connectivity and persists offline/online timestamps.
class ConnectivityService extends GetxService {
  ConnectivityService({Connectivity? connectivity, GetStorage? storage})
      : _connectivity = connectivity ?? Connectivity(),
        _storage = storage ?? GetStorage();

  final Connectivity _connectivity;
  final GetStorage _storage;

  StreamSubscription<ConnectivityResult>? _subscription;

  final RxBool isOnline = true.obs;
  final Rxn<DateTime> lastOfflineAt = Rxn<DateTime>();
  final Rxn<DateTime> lastOnlineAt = Rxn<DateTime>();

  static const _offlineKey = 'fh_last_offline_at';
  static const _onlineKey = 'fh_last_online_at';

  @override
  void onInit() {
    super.onInit();
    _restoreFromStorage();
    _subscription = _connectivity.onConnectivityChanged.listen(_handleChange);
    _initStatus();
  }

  Future<void> _initStatus() async {
    final result = await _connectivity.checkConnectivity();
    _handleChange(result, initial: true);
  }

  void _handleChange(ConnectivityResult result, {bool initial = false}) {
    final online = result != ConnectivityResult.none;
    final previous = isOnline.value;
    isOnline.value = online;

    if (!online && (initial ? true : previous != online)) {
      final now = DateTime.now();
      lastOfflineAt.value = now;
      _storage.write(_offlineKey, now.toIso8601String());
    } else if (online && (initial ? true : previous != online)) {
      final now = DateTime.now();
      lastOnlineAt.value = now;
      _storage.write(_onlineKey, now.toIso8601String());
    }
  }

  void _restoreFromStorage() {
    final offline = _storage.read<String>(_offlineKey);
    final online = _storage.read<String>(_onlineKey);
    if (offline != null) {
      try {
        lastOfflineAt.value = DateTime.parse(offline);
      } catch (_) {}
    }
    if (online != null) {
      try {
        lastOnlineAt.value = DateTime.parse(online);
      } catch (_) {}
    }
  }

  Duration? get lastOfflineDuration {
    final offline = lastOfflineAt.value;
    final online = lastOnlineAt.value;
    if (offline == null || online == null) return null;
    return online.difference(offline);
  }

  @override
  void onClose() {
    _subscription?.cancel();
    super.onClose();
  }
}
