import 'package:get/get.dart';
import '../core/api_client.dart';
import '../core/env/env.dart';
import '../models/mediaAssets_model.dart';

/// Paged result holder (items + total count).
class PagedResult<T> {
  final List<T> items;
  final int? total;
  const PagedResult(this.items, this.total);
}

class MediaAssetsService {
  final ApiClient _api = Get.find<ApiClient>();

  // Resolve paths using Env; allow per-service gateway override baked at generation time.
  final String? _micro = null;
  late final String _plural = Env.get().pluralFor('MediaAssets');
  String get _base => Env.get().entityBasePath(_plural, microserviceOverride: _micro);
  String get _searchBase => Env.get().searchBasePath(_plural, microserviceOverride: _micro);

  /// List with pagination, sorting and criteria filters.
  /// Returns only items; see [listPaged] to also get total.
  Future<List<MediaAssetsModel>> list({
    int? page,
    int? size,
    List<String>? sort,
    Map<String, dynamic>? filters,
    bool? distinct,
  }) async {
    final res = await _api.get(
      _base,
      query: _buildQuery(
        page: page,
        size: size,
        sort: sort ?? Env.get().defaultSort,
        filters: filters,
        distinct: distinct ?? Env.get().distinctByDefault,
      ),
    );
    if (!res.isOk) _throwHttp(res);

    final body = res.body;
    final List<dynamic> rows = _extractContentArray(body);
    return rows.map((e) => MediaAssetsModel.fromJson(Map<String, dynamic>.from(e))).toList();
  }

  /// Same as [list] but returns [PagedResult] with total count when available.
  Future<PagedResult<MediaAssetsModel>> listPaged({
    int? page,
    int? size,
    List<String>? sort,
    Map<String, dynamic>? filters,
    bool? distinct,
  }) async {
    final res = await _api.get(
      _base,
      query: _buildQuery(
        page: page,
        size: size,
        sort: sort ?? Env.get().defaultSort,
        filters: filters,
        distinct: distinct ?? Env.get().distinctByDefault,
      ),
    );
    if (!res.isOk) _throwHttp(res);

    final body = res.body;
    final List<dynamic> rows = _extractContentArray(body);
    final items = rows.map((e) => MediaAssetsModel.fromJson(Map<String, dynamic>.from(e))).toList();

    // Try header first, then JSON page structure fields
    int? total;
    final hdr = res.headers?[Env.get().totalCountHeaderName];
    if (hdr != null) {
      total = int.tryParse(hdr);
    } else if (body is Map) {
      total = (body['totalElements'] as num?)?.toInt();
    }
    return PagedResult<MediaAssetsModel>(items, total);
  }

  /// Optional explicit count endpoint (criteria-aware) if backend supports /count.
  Future<int> count({
    Map<String, dynamic>? filters,
    bool? distinct,
  }) async {
    final q = _buildQuery(
      filters: filters,
      distinct: distinct ?? Env.get().distinctByDefault,
    );
    final res = await _api.get(''${_base}/count'', query: q);
    if (!res.isOk) _throwHttp(res);

    final body = res.body;
    if (body is num) return body.toInt();
    if (body is String) return int.tryParse(body) ?? 0;
    if (body is Map && body['count'] != null) {
      final c = body['count'];
      if (c is num) return c.toInt();
      if (c is String) return int.tryParse(c) ?? 0;
    }
    return 0;
  }

  /// Full text search via Elasticsearch.
  Future<PagedResult<MediaAssetsModel>> search({
    required String query,
    int? page,
    int? size,
    List<String>? sort,
  }) async {
    final res = await _api.get(
      _searchBase,
      query: {
        'query': query,
        ..._buildQuery(
          page: page,
          size: size,
          sort: sort ?? Env.get().defaultSearchSort,
        ),
      },
    );
    if (!res.isOk) _throwHttp(res);

    final body = res.body;
    final List<dynamic> rows = _extractContentArray(body);
    final items = rows.map((e) => MediaAssetsModel.fromJson(Map<String, dynamic>.from(e))).toList();

    int? total;
    final hdr = res.headers?[Env.get().totalCountHeaderName];
    if (hdr != null) {
      total = int.tryParse(hdr);
    } else if (body is Map) {
      total = (body['totalElements'] as num?)?.toInt();
    }
    return PagedResult<MediaAssetsModel>(items, total);
  }

  Future<MediaAssetsModel> getOne(dynamic id) async {
    final res = await _api.get('${_base}/${Uri.encodeComponent(id.toString())}');
    if (!res.isOk) _throwHttp(res);
    return MediaAssetsModel.fromJson(Map<String, dynamic>.from(res.body));
  }

  Future<MediaAssetsModel> create(MediaAssetsModel body) async {
    final res = await _api.post(_base, body.toJson());
    if (!res.isOk) _throwHttp(res);
    return MediaAssetsModel.fromJson(Map<String, dynamic>.from(res.body));
  }

  Future<MediaAssetsModel> update(MediaAssetsModel body) async {
    final id = body.id;
    if (id == null) {
      throw Exception('MediaAssetsModel.update requires non-null id');
    }
    final res = await _api.put('${_base}/${Uri.encodeComponent(id.toString())}', body.toJson());
    if (!res.isOk) _throwHttp(res);
    return MediaAssetsModel.fromJson(Map<String, dynamic>.from(res.body));
  }

  /// JSON Merge Patch (RFC 7396) partial update.
  Future<MediaAssetsModel> patch(dynamic id, Map<String, dynamic> patchBody) async {
    final res = await _api.request(
      '${_base}/${Uri.encodeComponent(id.toString())}',
      'PATCH',
      body: patchBody,
      headers: {'Content-Type': 'application/merge-patch+json'},
    );
    if (!res.isOk) _throwHttp(res);
    return MediaAssetsModel.fromJson(Map<String, dynamic>.from(res.body));
  }

  Future<void> delete(dynamic id) async {
    final res = await _api.delete('${_base}/${Uri.encodeComponent(id.toString())}');
    if (!res.isOk) _throwHttp(res);
  }

  // ---------------- helpers ----------------

  /// Builds query params with page/size/sort + criteria filters + distinct.
  Map<String, dynamic> _buildQuery({
    int? page,
    int? size,
    List<String>? sort,
    Map<String, dynamic>? filters,
    bool? distinct,
  }) {
    final env = Env.get();
    final q = <String, dynamic>{};

    if (page != null) q['page'] = page;
    q['size'] = size ?? env.defaultPageSize;

    final sorts = sort ?? env.defaultSort;
    if (sorts.isNotEmpty) {
      // Let GetConnect encode a repeated 'sort' param properly by passing a List
      q['sort'] = sorts;
    }

    if (distinct == true) {
      q['distinct'] = 'true';
    }

    // criteria filters: { field: { op: value } }
    if (filters != null) {
      filters.forEach((field, ops) {
        if (ops == null) return;
        if (ops is Map) {
          ops.forEach((op, val) {
            if (val == null) return;
            final key = '${field}.${op}';
            if (op === 'in' && val is List) {
              q[key] = val.map((e) => e?.toString() ?? '').where((e) => e.isNotEmpty).join(',');
            } else {
              q[key] = val.toString();
            }
          });
        } else {
          // simple equals
          q['${field}.equals'] = ops.toString();
        }
      });
    }

    return q;
  }

  List<dynamic> _extractContentArray(dynamic body) {
    if (body is List) return body;
    if (body is Map && body['content'] is List) return List<dynamic>.from(body['content']);
    if (body is Map && body['data'] is List) return List<dynamic>.from(body['data']);
    return const <dynamic>[];
  }

  Never _throwHttp(Response res) {
    final code = res.statusCode ?? 0;
    final snippet = (res.bodyString ?? res.body?.toString() ?? '').toString();
    throw Exception('HTTP ' + code.toString() + ' — ' + snippet);
  }
}
