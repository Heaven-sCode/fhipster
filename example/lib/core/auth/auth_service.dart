import 'dart:convert';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../env/env.dart';
import 'token_decoder.dart';

/// AuthService stores & refreshes tokens.
/// Storage backend:
///  - Env.storageMode == 'secure_storage' => FlutterSecureStorage
///  - otherwise => GetStorage
class AuthService extends GetxService {
  late final EnvConfig _cfg;
  GetStorage? _box;
  FlutterSecureStorage? _secure;

  final username = RxnString();
  final authorities = <String>[].obs;

  @override
  void onInit() {
    super.onInit();
    _cfg = Env.get();

    if (_cfg.storageMode == 'secure_storage') {
      _secure = const FlutterSecureStorage();
    } else {
      _box = GetStorage();
    }
  }

  Future<String?> getAccessToken({bool forceFresh = false}) async {
    if (forceFresh) {
      final ok = await tryRefreshToken();
      if (!ok) {
        // fall through to whatever is stored
      }
    }
    return await _read(_cfg.storageKeyAccessToken);
  }

  Future<bool> tryRefreshToken() async {
    // TODO: Wire your actual refresh logic here (Keycloak refresh token or JWT re-auth).
    // Return true if token refreshed successfully, otherwise false.
    return false;
  }

  Future<void> saveTokens({
    required String accessToken,
    required DateTime? accessExpiry,
    String? refreshToken,
    DateTime? refreshExpiry,
  }) async {
    await _write(_cfg.storageKeyAccessToken, accessToken);
    await _write(_cfg.storageKeyAccessExpiry, accessExpiry?.millisecondsSinceEpoch.toString());
    if (refreshToken != null) {
      await _write(_cfg.storageKeyRefreshToken, refreshToken);
    }
    if (refreshExpiry != null) {
      await _write(_cfg.storageKeyRefreshExpiry, refreshExpiry.millisecondsSinceEpoch.toString());
    }

    try {
      final claims = decodeJwtClaims(accessToken);
      final roles = extractRoles(claims);
      authorities.assignAll(roles);
      username.value = claims['preferred_username']?.toString() ?? claims['sub']?.toString();
    } catch (_) {}
  }

  Future<void> logout() async {
    await _delete(_cfg.storageKeyAccessToken);
    await _delete(_cfg.storageKeyAccessExpiry);
    await _delete(_cfg.storageKeyRefreshToken);
    await _delete(_cfg.storageKeyRefreshExpiry);
    username.value = null;
    authorities.clear();
  }

  // ---------- storage helpers ----------

  Future<void> _write(String key, String? value) async {
    if (value == null) return;
    if (_secure != null) {
      await _secure!.write(key: key, value: value);
    } else {
      await _box!.write(key, value);
    }
  }

  Future<String?> _read(String key) async {
    if (_secure != null) {
      return await _secure!.read(key: key);
    } else {
      return _box!.read<String>(key);
    }
  }

  Future<void> _delete(String key) async {
    if (_secure != null) {
      await _secure!.delete(key: key);
    } else {
      await _box!.remove(key);
    }
  }
}
