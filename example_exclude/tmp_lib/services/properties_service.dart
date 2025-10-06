import 'package:get/get.dart';
import '../core/api_client.dart';
import '../core/env/env.dart';
import '../models/properties_model.dart';

/// Paged result holder (items + total count).
class PagedResult<T> {
  final List<T> items;
  final int? total;
  const PagedResult(this.items, this.total);
}

class PropertiesService {
  final ApiClient _api = Get.find<ApiClient>();


  // Resolve paths using Env; allow per-service gateway override baked at generation time.
  final String? _micro = 'operationsModule';
  late final String _plural = Env.pluralFor('Properties');
  String get _base => Env.entityBasePath(_plural, microserviceOverride: _micro);
  String get _searchBase => Env.searchBasePath(_plural, microserviceOverride: _micro);

  /// List with pagination, sorting and criteria filters.
  /// Returns only items; see [listPaged] to also get total.
  Future<List<PropertiesModel>> list({
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
    return rows.map((e) => PropertiesModel.fromJson(Map<String, dynamic>.from(e))).toList();
  }

  /// Same as [list] but returns [PagedResult] with total count when available.
  Future<PagedResult<PropertiesModel>> listPaged({
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
    final items = rows.map((e) => PropertiesModel.fromJson(Map<String, dynamic>.from(e))).toList();

    // Try header first, then JSON page structure fields
    int? total;
    final hdr = res.headers?[Env.get().totalCountHeaderName];
    if (hdr != null) {
      total = int.tryParse(hdr);
    } else if (body is Map) {
      total = (body['totalElements'] as num?)?.toInt();
    }
    return PagedResult<PropertiesModel>(items, total);
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
    final res = await _api.get('${_base}/count', query: q);
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
  Future<PagedResult<PropertiesModel>> search({
    required String query,
    int? page,
    int? size,
    List<String>? sort,
  }) async {
    final params = <String>[];
    params.add('query=$query');
    if (page != null) params.add('page=$page');
    if (size != null) params.add('size=$size');
    final sorts = sort ?? Env.get().defaultSearchSort;
    if (sorts.isNotEmpty) {
      params.addAll(sorts.map((s) => 'sort=$s'));
    }
    final url = params.isEmpty ? _searchBase : '${_searchBase}?${params.join('&')}';

    final res = await _api.get(url);
    if (!res.isOk) _throwHttp(res);

    final body = res.body;
    final List<dynamic> rows = _extractContentArray(body);
    final items = rows.map((e) => PropertiesModel.fromJson(Map<String, dynamic>.from(e))).toList();

    int? total;
    final hdr = res.headers?[Env.get().totalCountHeaderName];
    if (hdr != null) {
      total = int.tryParse(hdr);
    } else if (body is Map) {
      total = (body['totalElements'] as num?)?.toInt();
    }
    return PagedResult<PropertiesModel>(items, total);
  }

  Future<PropertiesModel> getOne(dynamic id) async {
    final res = await _api.get('${_base}/${Uri.encodeComponent(id.toString())}');
    if (!res.isOk) _throwHttp(res);
    return PropertiesModel.fromJson(Map<String, dynamic>.from(res.body));
  }

  Future<PropertiesModel> create(PropertiesModel body) async {
    final res = await _api.post(_base, body.toJson());
    if (!res.isOk) _throwHttp(res);
    return PropertiesModel.fromJson(Map<String, dynamic>.from(res.body));
  }

  Future<PropertiesModel> update(PropertiesModel body) async {
    final id = body.id;
    if (id == null) {
      throw Exception('PropertiesModel.update requires non-null id');
    }
    final res = await _api.put('${_base}/${Uri.encodeComponent(id.toString())}', body.toJson());
    if (!res.isOk) _throwHttp(res);
    return PropertiesModel.fromJson(Map<String, dynamic>.from(res.body));
  }

  /// JSON Merge Patch (RFC 7396) partial update.
  Future<PropertiesModel> patch(dynamic id, Map<String, dynamic> patchBody) async {
    final res = await _api.request(
      '${_base}/${Uri.encodeComponent(id.toString())}',
      'PATCH',
      body: patchBody,
      headers: {'Content-Type': 'application/merge-patch+json'},
    );
    if (!res.isOk) _throwHttp(res);
    return PropertiesModel.fromJson(Map<String, dynamic>.from(res.body));
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

    if (page != null) q['page'] = page.toString();
    q['size'] = (size ?? env.defaultPageSize).toString();

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
            if (op == 'in' && val is List) {
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
    final statusText = res.statusText;
    final exceptionText = res.status?.toString();
    final body = res.body;
    String bodyText = res.bodyString ?? '';
    if (bodyText.trim().isEmpty && body is Map) {
      final message = body['message'] ?? body['error_description'] ?? body['error'] ?? body['title'];
      if (message is String && message.trim().isNotEmpty) {
        bodyText = message.trim();
      }
    }
    if (bodyText.trim().isEmpty && statusText != null && statusText.trim().isNotEmpty) {
      bodyText = statusText.trim();
    }
    if (bodyText.trim().isEmpty && exceptionText != null && exceptionText.trim().isNotEmpty) {
      bodyText = exceptionText.trim();
    }
    if (bodyText.trim().isEmpty) {
      bodyText = code == 0 ? 'Network request failed' : 'Request failed without a response body';
    }
    final prefix = code == 0 ? 'NETWORK' : code.toString();
    throw ApiRequestException(code, 'HTTP ' + prefix + ' — ' + bodyText, res);
  }
}
