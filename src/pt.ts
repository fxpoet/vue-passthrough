import { useAttrs, computed, unref, type MaybeRef } from 'vue'
import { twMerge } from 'tailwind-merge';
import { isString, isObject, isEmpty, warn } from './utils';

// ============================================
// Type Definitions
// ============================================

export interface PtSpec {
    [key: string]: string | Record<string, any> | PtSpec | undefined;
}

// ============================================
// Theme Processing
// ============================================

// Theme processing result cache (using WeakMap to prevent memory leaks)
const themeCache = new WeakMap<PtSpec, Record<string, Record<string, any>>>();

/**
 * Theme processing: Normalization + extend resolution in one step
 *
 * 1. Convert strings → { class: "..." }
 * 2. Process extend attributes (detect circular references)
 * 3. Cache results (prevent duplicate processing for the same theme object)
 *
 * @example
 * processTheme({
 *   root: "grid gap-2",                          // → { class: "grid gap-2" }
 *   input: { class: "border" },                  // → { class: "border" }
 *   inputInvalid: { extend: 'input', class: "red" }  // → { class: "border red" }
 * })
 */
function processTheme(theme: PtSpec): Record<string, Record<string, any>> {
    // Check cache (performance optimization)
    const cached = themeCache.get(theme);
    if (cached) return cached;
    // Step 1: Normalization (string → object)
    const normalized: Record<string, Record<string, any>> = {};

    for (const key in theme) {
        const value = theme[key];

        if (isString(value)) {
            normalized[key] = { class: value };
        } else if (isObject(value)) {
            normalized[key] = value;
        }
    }

    // Step 2: Resolve extend (detect circular references)
    const result: Record<string, Record<string, any>> = {};
    const resolving = new Set<string>();  // Track keys currently being resolved

    /**
     * Helper function to recursively resolve extend
     * @returns Resolved attributes or null (if circular reference)
     */
    const resolveExtend = (key: string): Record<string, any> | null => {
        // Already resolved
        if (key in result) return result[key] || null;

        const value = normalized[key];
        if (!value) return null;

        // Return as-is if no extend
        if (!('extend' in value)) {
            result[key] = value;
            return value;
        }

        // Detect circular reference
        if (resolving.has(key)) {
            warn(`Circular reference detected: "${key}" - ignoring extend.`, {
                key,
                extend: value.extend,
                chain: Array.from(resolving)
            });
            const { extend, ...withoutExtend } = value;
            result[key] = withoutExtend;
            return withoutExtend;
        }

        // Start resolving
        resolving.add(key);

        const { extend, class: extendClass, ...rest } = value;
        const baseAttrs = resolveExtend(extend as string);

        // If extend target not found or failed due to circular reference
        if (!baseAttrs) {
            warn(`Extend target "${extend}" not found: "${key}"`, { key, extend });
            result[key] = { ...rest, class: extendClass || '' };
            resolving.delete(key);
            return result[key];
        }

        const { class: baseClass, ...baseRest } = baseAttrs;

        // Merge extend target
        result[key] = {
            ...baseRest,
            ...rest,
            class: twMerge(baseClass || '', extendClass || '')
        };

        resolving.delete(key);
        return result[key];
    };

    // Resolve extend for all keys
    for (const key in normalized) {
        resolveExtend(key);
    }

    // Save to cache (reuse on next call)
    themeCache.set(theme, result);

    return result;
}

// ============================================
// Core Functions
// ============================================

/**
 * Merge single key pt attribute (pt:root="class")
 * @internal Exported for testing purposes
 */
function mergeSingleKeyAttr(pt: PtSpec, key: string, value: unknown): void {
    if (!key) return;

    if (!(key in pt)) {
        pt[key] = {};
    }

    const current = pt[key];
    if (isObject(current)) {
        const existingClass = current.class;
        current.class = existingClass
            ? twMerge(existingClass as string, value as string)
            : value;
    } else {
        pt[key] = { class: value };
    }
}

/**
 * Merge nested pt attribute (pt:root:class="value")
 * @internal Exported for testing purposes
 */
function mergeNestedAttr(pt: PtSpec, keys: string[], value: unknown): void {
    let current: Record<string, unknown> = pt;

    // Create nested objects up to the last key
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!key) continue;

        if (!(key in current) || !isObject(current[key])) {
            current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
    }

    // Assign value to the last key
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
        current[lastKey] = value;
    }
}

/**
 * Extract pt-related attributes from attrs
 *
 * Supported formats:
 * - :pt="{ root: 'class' }" → object form
 * - pt:root="class" → shorthand (single key)
 * - pt:root:class="value" → nested attributes (class, id, onClick, etc.)
 */
export function attrsToPt(): PtSpec {
    const attrs = useAttrs();
    let pt = {} as PtSpec;
    let objectPt: PtSpec | null = null;

    for (const attrKey in attrs) {
        // Store :pt="{ ... }" format for later merge
        if (attrKey === 'pt') {
            const ptValue = attrs[attrKey];
            if (isObject(ptValue)) {
                objectPt = ptValue as PtSpec;
            }
            continue;
        }

        // Skip if doesn't start with pt:
        if (!attrKey.startsWith('pt:')) continue;

        const keys = attrKey.slice(3).split(':');
        const value = attrs[attrKey];

        // pt:root="text" format → { root: { class: "text" } }
        if (keys.length === 1) {
            mergeSingleKeyAttr(pt, keys[0], value);
        } else {
            // pt:root:class="text" format → nested object
            mergeNestedAttr(pt, keys, value);
        }
    }

    // Merge :pt object after processing all pt:* attributes
    return objectPt ? mergePt(pt, objectPt) : pt;
}

/**
 * Merge two PtSpec objects
 *
 * Merge rules:
 * 1. Strings are treated as class shorthand (converted to { class: "..." })
 * 2. class attributes are merged with twMerge (remove duplicates)
 * 3. Other attributes are merged with spread (pt2 takes priority)
 * 4. Nested objects without class are recursively merged
 *
 * @example
 * mergePt(
 *   { root: "grid", helper: { class: "text-sm" } },
 *   { root: "gap-2", helper: { class: "text-red-500" } }
 * )
 * // → { root: { class: "grid gap-2" }, helper: { class: "text-sm text-red-500" } }
 */
export function mergePt(pt1: PtSpec, pt2: PtSpec): PtSpec {
    const result: PtSpec = { ...pt1 };

    for (const key in pt2) {
        const val1 = result[key];
        const val2 = pt2[key];

        // Skip if pt2 value is empty
        if (!val2) continue;

        // Use pt2 value as-is if pt1 value is empty
        if (!val1) {
            result[key] = val2;
            continue;
        }

        // Treat strings as class shorthand → convert to object and merge
        const normalized1 = isString(val1) ? { class: val1 } : val1;
        const normalized2 = isString(val2) ? { class: val2 } : val2;

        // If both are objects
        if (isObject(normalized1) && isObject(normalized2)) {
            const hasClass = 'class' in normalized1 || 'class' in normalized2;

            if (hasClass) {
                // If has class attribute, treat as HTML attributes object
                // Prevent class duplication: manually separate and merge
                const { class: class1, ...rest1 } = normalized1;
                const { class: class2, ...rest2 } = normalized2;

                result[key] = {
                    ...rest1,
                    ...rest2,
                    class: twMerge(class1 || '', class2 || '')
                };
            } else {
                // If no class, treat as nested PtSpec and recursively merge
                result[key] = mergePt(normalized1 as PtSpec, normalized2 as PtSpec);
            }
        }
        else {
            // If either is not an object, overwrite with pt2 value
            result[key] = val2;
        }
    }

    return result;
}

/**
 * Extract nested PtSpec from a value (only if it doesn't have a class attribute)
 * @internal Exported for testing purposes
 */
function extractNestedPt(value: unknown): PtSpec {
    if (!value) return {};
    if (!isObject(value)) return {};
    if ('class' in value) return {};
    return value as PtSpec;
}

/**
 * Normalize a pt value to HTML attributes
 * @internal Exported for testing purposes
 */
function normalizePtValue(value: unknown): Record<string, any> {
    if (!value) return {};

    // If string (class shorthand)
    if (isString(value)) {
        return { class: value };
    }

    // If object
    if (isObject(value)) {
        return value as Record<string, any>;
    }

    return {};
}

/**
 * Merge theme's base attributes with pt to return final HTML attributes
 *
 * @param key - Element key (e.g., 'root', 'input', 'helper')
 * @param baseAttrs - Base attributes from theme
 * @param pt - User-provided pt (props.pt or attrs)
 * @returns Merged HTML attributes (passed to v-bind)
 *
 * @example
 * // theme: { input: { class: "border" } }
 * // pt: { input: { class: "border-red-500", id: "my-input" } }
 * ptAttrs('input', { class: "border" }, pt)
 * // → { class: "border border-red-500", id: "my-input" }
 */
function ptAttrs(
    key: string,
    baseAttrs: Record<string, any> = {},
    pt?: PtSpec
): Record<string, any> {
    const ptValue = pt?.[key];

    // Return only base attributes if key not in pt
    if (!ptValue) return baseAttrs;

    // Normalize pt value to HTML attributes
    const normalized = normalizePtValue(ptValue);

    // Separate class from both objects for special merging
    const { class: baseClass, ...baseRest } = baseAttrs;
    const { class: ptClass, ...ptRest } = normalized;

    return {
        ...baseRest,
        ...ptRest,  // Merge other pt attributes (id, onClick, etc.)
        class: twMerge(baseClass || '', ptClass || '')  // Merge class with twMerge
    };
}

// ============================================
// Composable: usePassThrough
// ============================================

/**
 * PassThrough system: Component style customization
 *
 * @description
 * The PassThrough system allows deep customization of component styles by merging
 * styles from three sources with intelligent replace vs merge strategies.
 *
 * **Merge Sources:**
 * 1. `theme` - Component default styles (lowest priority)
 * 2. `attrs` - Passed from parent as `pt:root="..."` format (middle priority)
 * 3. `propsPt` - Passed from parent as `:pt="{ root: '...' }"` format (highest priority)
 *
 * **Replace vs Merge Strategy:**
 * - **Replace (props.pt)**: When a key exists in `props.pt`, it completely replaces
 *   the theme for that key. Use for complete style overrides.
 * - **Merge (attrs)**: When using `pt:*` attributes, they merge additively with the
 *   theme. Use for extending existing styles.
 *
 * @param theme - Default theme configuration (flat structure)
 *   - Strings are automatically converted to `{ class: "..." }`
 *   - Supports `extend` attribute for style inheritance
 *   - Processed once and cached for performance
 * @param propsPt - Optional pt from props (MaybeRef for full reactivity)
 *   - Supports Vue refs and computed values
 *   - Changes trigger automatic re-rendering
 *
 * @returns Object containing:
 *   - `pt(key)` - Function to get HTML attributes for v-bind
 *   - `ptFor(key)` - Function to extract nested pt for child components
 *   - `debugPt` - Computed ref with final merged pt spec (for debugging)
 *
 * @example Basic usage
 * ```vue
 * <script setup lang="ts">
 * import { usePassThrough, type PtSpec } from 'vue-passthrough'
 *
 * const props = defineProps<{ pt?: PtSpec }>()
 *
 * const { pt } = usePassThrough({
 *   root: "grid gap-2",
 *   input: "border px-3"
 * }, computed(() => props.pt))
 * </script>
 *
 * <template>
 *   <div v-bind="pt('root')">
 *     <input v-bind="pt('input')" />
 *   </div>
 * </template>
 * ```
 *
 * @example Replace strategy (props.pt)
 * ```vue
 * <!-- Theme: { root: "grid gap-2" } -->
 * <MyComponent :pt="{ root: 'flex flex-row' }" />
 * <!-- Result: class="flex flex-row" (theme completely ignored) -->
 * ```
 *
 * @example Merge strategy (attrs)
 * ```vue
 * <!-- Theme: { root: "grid gap-2" } -->
 * <MyComponent pt:root="p-4 bg-white" />
 * <!-- Result: class="grid gap-2 p-4 bg-white" (additive merge) -->
 * ```
 *
 * @example Extend pattern
 * ```vue
 * <script setup>
 * const { pt } = usePassThrough({
 *   input: "w-full border px-3 py-2",
 *   inputInvalid: {
 *     extend: 'input',
 *     class: "border-red-500"
 *   }
 * })
 * </script>
 * <!-- inputInvalid inherits from input and adds red border -->
 * ```
 *
 * @example Nested components (ptFor)
 * ```vue
 * <script setup>
 * const { pt, ptFor } = usePassThrough({
 *   root: "flex gap-2",
 *   badge: {
 *     root: "px-2 py-1",
 *     label: "text-xs"
 *   }
 * })
 * </script>
 *
 * <template>
 *   <div v-bind="pt('root')">
 *     <Badge :pt="ptFor('badge')" />
 *   </div>
 * </template>
 * ```
 *
 * @see {@link https://github.com/fxpoet/vue-passthrough#usage | Usage Guide}
 * @see {@link https://github.com/fxpoet/vue-passthrough#api | API Reference}
 */
export function usePassThrough(
    theme: PtSpec,
    propsPt?: MaybeRef<PtSpec>
) {
    // 1. Extract pt from attrs (maintain reactivity with computed)
    //    Example: pt:root="bg-red-500" → { root: { class: "bg-red-500" } }
    const attrsPt = computed(() => attrsToPt());

    // 2. Process theme: normalization + extend resolution (execute once on initialization - performance optimization)
    //    Convert strings → objects, process extend attributes
    const normalizedTheme = processTheme(theme);

    // 3. Unwrap propsPt with computed (maintain reactivity)
    const resolvedPropsPt = computed(() => unref(propsPt) || {});

    // 4. Final pt (for debugging): props.pt replaces, attrs merges
    //    - If key exists in propsPt: use only propsPt[key] (replace)
    //    - If key doesn't exist in propsPt: use attrsPt[key] (merge with theme)
    const debugPt = computed(() => {
        const result: PtSpec = { ...attrsPt.value };
        const propsValue = resolvedPropsPt.value;

        // Keys in propsPt ignore attrsPt and replace
        for (const key in propsValue) {
            result[key] = propsValue[key];
        }

        return result;
    });

    /**
     * pt function: Return HTML attributes for use with v-bind
     *
     * Replace vs Merge strategy:
     * - If key exists in propsPt: ignore theme and use only propsPt (REPLACE)
     * - If key doesn't exist in propsPt: merge theme + attrsPt (MERGE)
     */
    const pt = (key: string): Record<string, any> => {
        const propsValue = resolvedPropsPt.value;

        // If key exists in propsPt, ignore theme (REPLACE)
        if (key in propsValue) {
            return normalizePtValue(propsValue[key]);
        }

        // If key doesn't exist in propsPt, merge theme + attrsPt (MERGE)
        const baseAttrs = normalizedTheme[key] || {};
        return ptAttrs(key, baseAttrs, attrsPt.value);
    };

    /**
     * Helper to pass pt to child components
     *
     * Extract only nested objects without class attribute and pass to child components
     * Apply replace strategy: ignore theme if key exists in propsPt, use theme otherwise
     *
     * @example
     * // In Button component
     * <Badge :pt="ptFor('badge')" />
     */
    const ptFor = (componentKey: string): PtSpec => {
        const propsValue = resolvedPropsPt.value;

        // If key exists in propsPt, ignore theme (REPLACE)
        if (componentKey in propsValue) {
            return extractNestedPt(propsValue[componentKey]);
        }

        // If key doesn't exist in propsPt, use theme + attrs
        const attrsValue = attrsPt.value[componentKey];
        if (attrsValue) {
            const nested = extractNestedPt(attrsValue);
            if (!isEmpty(nested)) {
                return nested;
            }
        }

        // If not in attrs either, use theme
        return extractNestedPt(normalizedTheme[componentKey]);
    };

    return {
        /**
         * pt function for use with v-bind (full reactivity)
         * @example v-bind="pt('root')"
         */
        pt,

        /**
         * Pass pt to child components
         * @example <Badge :pt="ptFor('badge')" />
         */
        ptFor,

        /**
         * Final merged pt spec (for debugging)
         */
        debugPt
    };
}

// Alias (for shorter usage)
export const usePt = usePassThrough;

// ============================================
// Internal utilities (exported for testing)
// ============================================

/**
 * Internal utilities exposed for testing purposes.
 * These are not part of the public API and may change without notice.
 *
 * @internal
 * @example
 * ```ts
 * import { _internal } from 'vue-passthrough'
 *
 * // Testing type guards
 * expect(_internal.isString('test')).toBe(true)
 * expect(_internal.isObject([])).toBe(false) // Arrays are not plain objects
 *
 * // Testing normalization
 * const result = _internal.normalizePtValue('text-red-500')
 * expect(result).toEqual({ class: 'text-red-500' })
 * ```
 */
export const _internal = {
    // Core processing
    processTheme,

    // Utility functions
    extractNestedPt,
    normalizePtValue,
    mergeSingleKeyAttr,
    mergeNestedAttr,
    ptAttrs,

    // Type guards
    isString,
    isObject,
    isEmpty,

    // Development helpers
    warn
} as const;
