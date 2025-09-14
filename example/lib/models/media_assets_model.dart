/// Generated model for MediaAssets.
/// Relationships are typed per cardinality and serialized using Env.relationshipPayloadMode.
import '../core/env/env.dart';
import '../models/properties_model.dart';


class MediaAssetsModel {
  final int? id;
  final String? image;
  final String? title;
  final PropertiesModel? properties;

  const MediaAssetsModel({
    this.id,
    this.image,
    this.title,
    this.properties,
  });

  MediaAssetsModel copyWith({
    int? id,
    String? image,
    String? title,
    PropertiesModel? properties,
  }) {
    return MediaAssetsModel(
      id: id ?? this.id,
      image: image ?? this.image,
      title: title ?? this.title,
      properties: properties ?? this.properties,
    );
  }

  factory MediaAssetsModel.fromJson(Map<String, dynamic> json) => MediaAssetsModel(
    id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? ''),
    image: json['image']?.toString(),
    title: json['title']?.toString(),
    properties: (json['properties'] is Map)
        ? PropertiesModel.fromJson(Map<String, dynamic>.from(json['properties']))
        : (json['propertiesId'] != null ? PropertiesModel(id: json['propertiesId']) : null),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'image': image,
    'title': title,
    'properties': (() {
      final mode = Env.get().relationshipPayloadMode;
      if (properties == null) return null;
      if (mode == RelationshipPayloadMode.idOnly) return {'id': properties!.id};
      return properties!.toJson();
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
