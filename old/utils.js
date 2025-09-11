/**
 * Converts a camelCase string to kebab-case.
 * @param {string} camelCaseString - The string in camelCase.
 * @returns {string} The string in kebab-case.
 */
function camelToKebabCase(camelCaseString) {
    return camelCaseString.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

module.exports = { camelToKebabCase };
