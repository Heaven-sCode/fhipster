/// Generated model for Properties.
/// Relationships are typed per cardinality and serialized using Env.relationshipPayloadMode.
import '../core/env/env.dart';
import '../models/mediaAssets_model.dart';


class PropertiesModel {
  final int? id;
  final String? title;
  final double? area;
  final String? value;
  final String? facilities;
  final List<MediaAssetsModel>? mediaAssets;

  const PropertiesModel({
    this.id,
    this.title,
    this.area,
    this.value,
    this.facilities,
    this.mediaAssets,
  });

  PropertiesModel copyWith({
    int? id,
    String? title,
    double? area,
    String? value,
    String? facilities,
    List<MediaAssetsModel>? mediaAssets,
  }) {
    return PropertiesModel(
      id: id ?? this.id,
      title: title ?? this.title,
      area: area ?? this.area,
      value: value ?? this.value,
      facilities: facilities ?? this.facilities,
      mediaAssets: mediaAssets ?? this.mediaAssets,
    );
  }

  factory PropertiesModel.fromJson(Map<String, dynamic> json) => PropertiesModel(
    id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? ''),
    title: json['title']?.toString(),
    area: json['area'] is num ? (json['area'] as num).toDouble() : double.tryParse(json['area']?.toString() ?? ''),
    value: json['value']?.toString(),
    facilities: json['facilities']?.toString(),
    mediaAssets: (json['mediaAssets'] is List)
        ? (json['mediaAssets'] as List).whereType<dynamic>().map((e) {
            if (e is Map) return MediaAssetsModel.fromJson(Map<String, dynamic>.from(e));
            // id fallback
            return MediaAssetsModel(id: e);
          }).toList()
        : null,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'area': area,
    'value': value,
    'facilities': facilities,
    'mediaAssets': (() {
      final mode = Env.get().relationshipPayloadMode;
      if (mediaAssets == null) return null;
      if (mode == RelationshipPayloadMode.idOnly) {
        return mediaAssets!.map((e) => {'id': e.id}).toList();
      }
      return mediaAssets!.map((e) => e.toJson()).toList();
    })(),
  };
}

// ----------------- helpers -----------------

Duration? _parseDuration(dynamic v) {
  if (v == null) return null;
  if (v is int) return Duration(seconds: v);
  if (v is String) {
    // try seconds
    final n = int.tryParse(v);
    if (n != null) return Duration(seconds: n);
    // TODO: parse ISO-8601 duration PnDTnHnMnS if needed
  }
  return null;
}
