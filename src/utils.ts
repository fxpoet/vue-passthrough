/**
 * Utility functions for vue-passthrough
 * @module utils
 */

/**
 * Check if value is a string
 * @param value - Value to check
 * @returns True if value is a string
 *
 * @example
 * ```ts
 * isString('hello')  // true
 * isString(123)      // false
 * isString(null)     // false
 * ```
 */
export const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * Check if value is a plain object (not Array, Date, null, etc.)
 *
 * This function specifically checks for plain objects created with `{}` or `new Object()`.
 * It excludes:
 * - Arrays
 * - null
 * - Date objects
 * - RegExp objects
 * - Any other objects with custom prototypes
 *
 * @param value - Value to check
 * @returns True if value is a plain object
 *
 * @example
 * ```ts
 * isObject({})                    // true
 * isObject({ key: 'value' })      // true
 * isObject([])                    // false (Array)
 * isObject(null)                  // false
 * isObject(new Date())            // false (Date)
 * isObject(new Map())             // false (Map)
 * ```
 */
export const isObject = (value: unknown): value is Record<string, any> => {
    return value != null
        && typeof value === 'object'
        && !Array.isArray(value)
        && Object.getPrototypeOf(value) === Object.prototype;
};

/**
 * Check if an object is empty (has no own enumerable properties)
 *
 * More performant than `Object.keys(obj).length === 0` as it returns
 * immediately upon finding the first property.
 *
 * @param obj - Object to check
 * @returns True if object has no own enumerable properties
 *
 * @example
 * ```ts
 * isEmpty({})              // true
 * isEmpty({ a: 1 })        // false
 * isEmpty({ a: undefined }) // false (property exists even if value is undefined)
 * ```
 */
export function isEmpty(obj: Record<string, any>): boolean {
    for (const _ in obj) return false;
    return true;
}

/**
 * Development mode detection
 *
 * Defaults to `true` (warnings enabled) in all environments.
 * Bundlers can use tree-shaking to remove warning code in production builds
 * when this is set to a constant `false`.
 *
 * @internal
 */
export const isDev = true;

/**
 * Warning helper that only logs in development mode
 *
 * Formats warnings with a consistent prefix and optional details object.
 * Details are pretty-printed as JSON for better readability.
 *
 * @param message - Warning message
 * @param details - Optional details object to include in the warning
 *
 * @example
 * ```ts
 * warn('Something went wrong')
 * // Output: [vue-passthrough] Something went wrong
 *
 * warn('Invalid value', { key: 'root', value: 123 })
 * // Output:
 * // [vue-passthrough] Invalid value
 * // {
 * //   "key": "root",
 * //   "value": 123
 * // }
 * ```
 *
 * @internal
 */
export function warn(message: string, details?: Record<string, unknown>): void {
    if (!isDev) return;

    // Format message with details for better debugging
    let fullMessage = `[vue-passthrough] ${message}`;
    if (details && Object.keys(details).length > 0) {
        fullMessage += '\n' + JSON.stringify(details, null, 2);
    }

    console.warn(fullMessage);
}
