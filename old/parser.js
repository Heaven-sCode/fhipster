/**
 * Maps a JDL data type to its corresponding Dart type.
 * @param {string} jdlType - The JDL type (e.g., 'String', 'Long', 'LocalDate').
 * @param {object} parsedEnums - The object of parsed enums to check against.
 * @returns {string} The corresponding Dart type.
 */
function jdlToDartType(jdlType, parsedEnums) {
    const typeMapping = {
        'String': 'String',
        'Integer': 'int',
        'Long': 'int',
        'Float': 'double',
        'Double': 'double',
        'BigDecimal': 'double',
        'LocalDate': 'DateTime',
        'Instant': 'DateTime',
        'ZonedDateTime': 'DateTime',
        'Boolean': 'bool',
        'UUID': 'String',
        'TextBlob':'String'
    };

    const listMatch = jdlType.match(/^List<(\w+)>$/);
    if (listMatch) {
        const innerType = listMatch[1];
        if (parsedEnums[innerType]) {
            return `List<${innerType}>`;
        }
    }

    if (parsedEnums[jdlType]) {
        return jdlType;
    }
    return typeMapping[jdlType] || 'dynamic';
}

/**
 * Parses the content of a JDL file to extract entities, fields, relationships, and enums.
 * @param {string} jdlContent - The raw string content of the JDL file.
 * @returns {{entities: object, enums: object}} An object containing parsed entities and enums.
 */
function parseJdl(jdlContent) {
    const entities = {};
    const parsedEnums = {};

    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    let enumMatch;
    while ((enumMatch = enumRegex.exec(jdlContent)) !== null) {
        const enumName = enumMatch[1];
        const rawValuesStr = enumMatch[2].trim();
        const values = rawValuesStr.split(',')
            .map(val => val.trim().split('(')[0].trim())
            .filter(val => val.length > 0);
        parsedEnums[enumName] = values;
    }

    const entityRegex = /(@\w+\s*)*entity\s+(\w+)\s*\{([^}]+)\}/g;
    let entityMatch;
    while ((entityMatch = entityRegex.exec(jdlContent)) !== null) {
        const annotations = entityMatch[1] || '';
        const entityName = entityMatch[2];
        let rawFieldsStr = entityMatch[3];

        let cleanedFieldsStr = rawFieldsStr.replace(/\/\*[\s\S]*?\*\//g, '');
        cleanedFieldsStr = cleanedFieldsStr.replace(/\/\/.*$/gm, '');

        const lines = cleanedFieldsStr.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const fields = [];
        const fieldLineRegex = /^(\w+)\s+([\w<>]+)/; 

        for (const line of lines) {
            const fieldMatch = line.match(fieldLineRegex);
            if (fieldMatch) {
                fields.push({ name: fieldMatch[1], type: fieldMatch[2], isRelationship: false });
            }
        }
        
        fields.unshift({ name: 'id', type: 'Long', isRelationship: false });

        if (annotations.includes('@EnableAudit')) {
            fields.push(
                { name: 'lastModifiedDate', type: 'Instant', isRelationship: false },
                { name: 'lastModifiedBy', type: 'String', isRelationship: false },
                { name: 'createdDate', type: 'Instant', isRelationship: false },
                { name: 'createdBy', type: 'String', isRelationship: false }
            );
        }
        entities[entityName] = fields;
    }

    const relationshipRegex = /relationship\s+(OneToOne|ManyToOne|OneToMany|ManyToMany)\s*\{\s*(\w+)(?:\((\w+)\))?\s+to\s+(\w+)(?:\((\w+)\))?\s*(?:(?:required|with\s+jpaDerivedIdentifier|id)\s*)*\}/g;
    let relationshipMatch;
    relationshipRegex.lastIndex = 0;

    while ((relationshipMatch = relationshipRegex.exec(jdlContent)) !== null) {
        const relationshipType = relationshipMatch[1];
        const fromEntityName = relationshipMatch[2];
        const fromFieldOnFromEntity = relationshipMatch[3];
        const toEntityName = relationshipMatch[4];
        const toFieldOnToEntity = relationshipMatch[5];

        if (!entities[fromEntityName] || !entities[toEntityName]) {
            console.warn(`Warning: Relationship involves undefined entity. Skipping: ${relationshipMatch[0]}`);
            continue;
        }

        let fromFieldName;
        let fromFieldType;
        if (relationshipType === 'OneToMany' || relationshipType === 'ManyToMany') {
            fromFieldType = `List<${toEntityName}>`;
            fromFieldName = fromFieldOnFromEntity || (toEntityName.charAt(0).toLowerCase() + toEntityName.slice(1) + 's');
        } else {
            fromFieldType = toEntityName;
            fromFieldName = fromFieldOnFromEntity || (toEntityName.charAt(0).toLowerCase() + toEntityName.slice(1));
        }
        if (!entities[fromEntityName].some(field => field.name === fromFieldName)) {
            entities[fromEntityName].push({
                name: fromFieldName,
                type: fromFieldType,
                isRelationship: true,
                relationshipType: relationshipType,
                targetEntity: toEntityName,
            });
        }

        let toFieldName;
        let toFieldType;
        let inverseRelationshipType;
        if (relationshipType === 'OneToOne') inverseRelationshipType = 'OneToOne';
        else if (relationshipType === 'ManyToOne') inverseRelationshipType = 'OneToMany';
        else if (relationshipType === 'OneToMany') inverseRelationshipType = 'ManyToOne';
        else if (relationshipType === 'ManyToMany') inverseRelationshipType = 'ManyToMany';

        if (inverseRelationshipType === 'OneToMany' || inverseRelationshipType === 'ManyToMany') {
            toFieldType = `List<${fromEntityName}>`;
            toFieldName = toFieldOnToEntity || (fromEntityName.charAt(0).toLowerCase() + fromEntityName.slice(1) + 's');
        } else {
            toFieldType = fromEntityName;
            toFieldName = toFieldOnToEntity || (fromEntityName.charAt(0).toLowerCase() + fromEntityName.slice(1));
        }
        if (!entities[toEntityName].some(field => field.name === toFieldName)) {
            entities[toEntityName].push({
                name: toFieldName,
                type: toFieldType,
                isRelationship: true,
                relationshipType: inverseRelationshipType,
                targetEntity: fromEntityName,
            });
        }
    }

    return { entities, enums: parsedEnums };
}

// Export the functions to be used in other modules
module.exports = {
    parseJdl,
    jdlToDartType
};
