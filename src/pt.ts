import { useAttrs, computed, unref, mergeProps, type MaybeRef } from 'vue'
import { twMerge } from 'tailwind-merge';
import { isString, isObject, isEmpty, warn, toClassObject, normalizeValue } from './utils';

export interface PtSpec {
    /** When true, merges with theme instead of replacing (works with both ptMark and ptFor) */
    $merge?: boolean;
    /** When true, explicitly replaces theme (default behavior, for clarity) */
    $replace?: boolean;
    [key: string]: string | Record<string, any> | PtSpec | boolean | undefined;
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
        const nValue = normalizeValue(theme[key]);
        if (!isEmpty(nValue)) {
            normalized[key] = nValue;
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

    for (const key in normalized) {
        resolveExtend(key);
    }

    themeCache.set(theme, result);

    return result;
}

// ============================================
// Merge Strategy Helpers
// ============================================

interface MergeFlags {
    $merge?: boolean;
    $replace?: boolean;
}

/**
 * Determine merge strategy from flags
 *
 * @param keyFlags - Flags on the specific key ({ $merge, $replace })
 * @param topLevelFlags - Top-level flags from pt object
 * @returns { shouldMerge, shouldReplace, warnBothSet }
 */
function getMergeStrategy(
    keyFlags: MergeFlags,
    topLevelFlags: MergeFlags = {}
): { shouldMerge: boolean; shouldReplace: boolean; warnBothSet: boolean } {
    const hasMerge = keyFlags.$merge === true;
    const hasReplace = keyFlags.$replace === true;
    const topLevelMerge = topLevelFlags.$merge === true;
    const topLevelReplace = topLevelFlags.$replace === true;

    // Key-level flags take priority over top-level
    const shouldMerge = hasMerge || (topLevelMerge && !hasReplace);
    const shouldReplace = hasReplace || (topLevelReplace && !hasMerge);

    return {
        shouldMerge,
        shouldReplace,
        warnBothSet: hasMerge && hasReplace
    };
}

/**
 * Apply tailwind-merge to class attribute if present
 */
function applyTailwindMerge(attrs: Record<string, any>): Record<string, any> {
    if (attrs.class !== undefined && attrs.class !== null) {
        return { ...attrs, class: twMerge(attrs.class as string) };
    }
    return attrs;
}

/**
 * Merge base attributes with additional attributes using mergeProps + tailwind-merge
 */
function mergeAttrs(
    base: Record<string, any>,
    additional: Record<string, any>
): Record<string, any> {
    if (isEmpty(additional)) return base;
    return applyTailwindMerge(mergeProps(base, additional));
}

// ============================================
// Core Functions
// ============================================

/**
 * Merge single key pt attribute (pt:root="class")
 *
 * Handles the shorthand syntax where only a key is specified.
 * The value is treated as a class string and merged with existing classes.
 *
 * @param pt - Target PtSpec object to merge into
 * @param key - Element key (e.g., 'root', 'input')
 * @param value - Class string to merge
 *
 * @example
 * const pt = { root: { class: "grid" } }
 * mergeSingleKeyAttr(pt, "root", "gap-2")
 * // → pt.root = { class: "grid gap-2" }
 *
 * @example
 * const pt = {}
 * mergeSingleKeyAttr(pt, "input", "border px-3")
 * // → pt.input = { class: "border px-3" }
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
        pt[key] = toClassObject(value as string);
    }
}

/**
 * Merge nested pt attribute (pt:root:class="value")
 *
 * Handles the nested syntax where multiple keys are specified.
 * Creates nested objects and assigns the value to the final key.
 *
 * @param pt - Target PtSpec object to merge into
 * @param keys - Array of nested keys (e.g., ['root', 'class'] or ['input', 'onClick'])
 * @param value - Value to assign to the final key
 *
 * @example
 * const pt = {}
 * mergeNestedAttr(pt, ["root", "class"], "grid gap-2")
 * // → pt.root = { class: "grid gap-2" }
 *
 * @example
 * const pt = { input: { class: "border" } }
 * mergeNestedAttr(pt, ["input", "onClick"], () => console.log('clicked'))
 * // → pt.input = { class: "border", onClick: [Function] }
 *
 * @example
 * const pt = {}
 * mergeNestedAttr(pt, ["root", "id"], "my-element")
 * // → pt.root = { id: "my-element" }
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
 * Uses Vue's mergeProps for proper event handler chaining and style merging,
 * combined with tailwind-merge for class conflict resolution.
 *
 * Merge rules:
 * 1. Strings are treated as class shorthand (converted to { class: "..." })
 * 2. HTML attributes are merged with Vue's mergeProps (event handlers are chained)
 * 3. class attributes are further processed with twMerge (remove Tailwind conflicts)
 * 4. Nested objects without class are recursively merged
 *
 * @example
 * mergePt(
 *   { root: "grid", helper: { class: "text-sm", onClick: fn1 } },
 *   { root: "gap-2", helper: { class: "text-red-500", onClick: fn2 } }
 * )
 * // → {
 * //   root: { class: "grid gap-2" },
 * //   helper: { class: "text-sm text-red-500", onClick: [fn1, fn2] }
 * // }
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
        const normalized1 = isString(val1) ? toClassObject(val1) : val1;
        const normalized2 = isString(val2) ? toClassObject(val2) : val2;

        // If both are objects
        if (isObject(normalized1) && isObject(normalized2)) {
            const hasClass = 'class' in normalized1 || 'class' in normalized2;

            if (hasClass) {
                // If has class attribute, treat as HTML attributes object
                // Use mergeProps for proper event handler chaining and style merging
                const merged = mergeProps(
                    normalized1 as Record<string, any>,
                    normalized2 as Record<string, any>
                );

                // Apply tailwind-merge to class for conflict resolution
                if (merged.class !== undefined && merged.class !== null) {
                    merged.class = twMerge(merged.class as string);
                }

                result[key] = merged;
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
 *
 * Used to extract nested pt specifications for child components.
 * Objects with a 'class' attribute are considered HTML attributes, not nested pt specs.
 *
 * @param value - Value to extract nested pt from
 * @returns Nested PtSpec if valid, empty object otherwise
 *
 * @example
 * extractNestedPt({ root: "grid", input: "border" })
 * // → { root: "grid", input: "border" }
 *
 * @example
 * extractNestedPt({ class: "border", onClick: fn })
 * // → {} (has class attribute, treated as HTML attributes)
 *
 * @example
 * extractNestedPt("text-sm")
 * // → {} (not an object)
 *
 * @example
 * extractNestedPt(null)
 * // → {} (falsy value)
 */
function extractNestedPt(value: unknown): PtSpec {
    if (!value) return {};
    if (!isObject(value)) return {};
    if ('class' in value) return {};
    return value as PtSpec;
}

/**
 * Merge theme's base attributes with pt to return final HTML attributes
 *
 * Uses Vue's mergeProps for proper event handler chaining and style merging,
 * combined with tailwind-merge for class conflict resolution.
 *
 * @param key - Element key (e.g., 'root', 'input', 'helper')
 * @param baseAttrs - Base attributes from theme
 * @param pt - User-provided pt (props.pt or attrs)
 * @returns Merged HTML attributes (passed to v-bind)
 *
 * @example Input
 * ptAttrs('input',
 *   { class: "border", onClick: fn1 },
 *   { input: { class: "border-red-500", onClick: fn2, id: "my-input" } }
 * )
 *
 * @example Output
 * // → { class: "border-red-500", onClick: [fn1, fn2], id: "my-input" }
 * // Both onClick handlers will execute, class conflicts resolved by tailwind-merge
 *
 * @example Input - No pt override
 * ptAttrs('helper', { class: "text-sm text-gray-500" }, {})
 *
 * @example Output
 * // → { class: "text-sm text-gray-500" }
 *
 * @example Input - Tailwind conflict resolution
 * ptAttrs('root',
 *   { class: "p-4 bg-blue-500" },
 *   { root: { class: "p-6 bg-red-500" } }
 * )
 *
 * @example Output
 * // → { class: "p-6 bg-red-500" }
 * // Later values override conflicting utilities (p-6 overrides p-4, bg-red-500 overrides bg-blue-500)
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
    const normalized = normalizeValue(ptValue);

    // Use Vue's mergeProps for proper event handler chaining and style merging
    const merged = mergeProps(baseAttrs, normalized);

    // Apply tailwind-merge to class for conflict resolution
    // (mergeProps concatenates classes, but we need tailwind conflict resolution)
    if (merged.class !== undefined && merged.class !== null) {
        merged.class = twMerge(merged.class as string);
    }

    return merged;
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
 * **Merge Sources (priority order):**
 * 1. `theme` - Component default styles (lowest priority)
 * 2. `attrs` - Passed from parent as `pt:root="..."` format (middle priority, always MERGE)
 * 3. `propsPt` - Passed from parent as `:pt="{ root: '...' }"` format (highest priority)
 *
 * **Replace vs Merge Strategy:**
 * - **Replace (default for props.pt)**: When a key exists in `props.pt`, theme is ignored
 * - **Merge (attrs or `$merge: true`)**: Styles are combined with tailwind-merge
 * - Use `$merge: true` on a key to merge with theme instead of replacing
 * - Use `$replace: true` for explicit replace (same as default, clearer intent)
 * - `$merge` cascades through `ptFor` to child components (Solution A)
 *
 * @param theme - Default theme configuration
 *   - Strings are automatically converted to `{ class: "..." }`
 *   - Supports `extend` attribute for style inheritance
 *   - Supports `$merge: true` for nested pt to cascade to children
 *   - Processed once and cached for performance
 * @param propsPt - Required pt from props (MaybeRef for full reactivity)
 *   - Always pass props.pt, even if it may be undefined
 *   - Supports Vue refs and computed values
 *   - Warning is shown if this parameter is omitted
 *
 * @returns Object containing:
 *   - `ptMark(key)` - Get HTML attributes for v-bind
 *   - `ptFor(key)` - Extract nested pt for child components (with $merge cascade)
 *   - `debugPt` - Computed ref with final merged pt spec (for debugging)
 *
 * @example
 * ```ts
 * const theme = defineTheme({
 *   root: 'grid gap-2',
 *   input: 'border px-3',
 *   badge: { $merge: true, root: 'px-2' }  // Cascades $merge to Badge
 * })
 * const { ptMark, ptFor } = usePassThrough(theme, props.pt)
 * ```
 *
 * @see {@link https://github.com/fxpoet/vue-passthrough | Documentation}
 */
export function usePassThrough<T extends PtSpec = PtSpec>(
    theme: T,
    propsPt: MaybeRef<PtSpec | undefined>
) {
    // Warn if propsPt is not provided
    if (propsPt === undefined) {
        warn('usePassThrough: propsPt (props.pt) is required. Pass props.pt even if it may be undefined.', {
            hint: 'Usage: usePassThrough(theme, props.pt)'
        });
    }

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
     * ptMark: Return HTML attributes for use with v-bind
     *
     * **Strategy:**
     * - Default: REPLACE (if key exists in props.pt, theme is ignored)
     * - With `$merge: true`: MERGE (theme + attrs + props.pt)
     * - Key-level flags take priority over top-level flags
     * - If key doesn't exist in props.pt: merge theme + attrs
     */
    const ptMark = (key: ThemeKeys<T>): Record<string, any> => {
        const propsValue = resolvedPropsPt.value;
        const baseAttrs = normalizedTheme[key] || {};

        // Key not in props → merge theme + attrs
        if (!(key in propsValue)) {
            return ptAttrs(key, baseAttrs, attrsPt.value);
        }

        const ptValue = propsValue[key];
        const topLevelFlags = { $merge: propsValue.$merge, $replace: propsValue.$replace };

        // Object value: check for merge flags
        if (isObject(ptValue)) {
            const { shouldMerge, shouldReplace, warnBothSet } = getMergeStrategy(ptValue, topLevelFlags);

            if (warnBothSet) {
                warn(`Both $merge and $replace are set for "${key}". Using $merge.`, { key });
            }

            if (shouldMerge) {
                const { $merge, $replace, ...rest } = ptValue as Record<string, any>;
                const themeWithAttrs = ptAttrs(key, baseAttrs, attrsPt.value);
                return mergeAttrs(themeWithAttrs, normalizeValue(rest));
            }

            if (shouldReplace) {
                const { $replace, ...rest } = ptValue as Record<string, any>;
                return normalizeValue(rest);
            }
        }
        // Primitive value with top-level $merge
        else if (topLevelFlags.$merge) {
            const themeWithAttrs = ptAttrs(key, baseAttrs, attrsPt.value);
            return mergeAttrs(themeWithAttrs, normalizeValue(ptValue));
        }

        // REPLACE (default): ignore theme
        return normalizeValue(ptValue);
    };

    /**
     * ptFor: Extract nested pt for child components
     *
     * **Strategy:**
     * - Default: REPLACE (if key exists in props.pt, theme is ignored)
     * - With `$merge: true`: MERGE (theme → attrs → props.pt), cascades to child
     * - With `$replace: true`: REPLACE (explicit)
     * - If key doesn't exist in props.pt: use theme + attrs
     */
    const ptFor = (componentKey: ThemeKeys<T>): PtSpec => {
        const propsValue = resolvedPropsPt.value;
        const themePt = extractNestedPt(normalizedTheme[componentKey]);
        const attrsPtNested = extractNestedPt(attrsPt.value[componentKey]);

        // Key not in props → use theme + attrs
        if (!(componentKey in propsValue)) {
            if (!isEmpty(attrsPtNested)) return attrsPtNested;
            return themePt;
        }

        const propsNested = extractNestedPt(propsValue[componentKey]);
        if (!propsNested) return propsNested;

        const { shouldMerge, shouldReplace, warnBothSet } = getMergeStrategy(propsNested);

        if (warnBothSet) {
            warn(`Both $merge and $replace are set for "${componentKey}". Using $merge.`, { key: componentKey });
        }

        if (shouldMerge) {
            const { $merge, $replace, ...rest } = propsNested;

            // MERGE: theme → attrs → props.pt
            let result = themePt;
            if (!isEmpty(attrsPtNested)) {
                result = mergePt(result, attrsPtNested);
            }
            if (!isEmpty(rest)) {
                result = mergePt(result, rest as PtSpec);
            }

            // Cascade $merge to child (Solution A)
            return result.$merge ? result : { $merge: true, ...result };
        }

        if (shouldReplace) {
            const { $replace, ...rest } = propsNested;
            return rest as PtSpec;
        }

        // REPLACE (default): ignore theme
        return propsNested;
    };

    return {
        ptMark,
        ptFor,
        debugPt
    };
}

// Alias (for shorter usage)
export const usePt = usePassThrough;

// ============================================
// Type Helpers
// ============================================

/**
 * Define a strongly-typed theme with improved type inference
 *
 * This helper function provides better TypeScript support by preserving
 * the exact structure of your theme, enabling autocomplete for ptMark/ptFor keys
 * and compile-time validation of theme references.
 *
 * @param theme - Theme configuration object
 * @returns The same theme object with preserved type information
 *
 * @example Basic usage
 * ```ts
 * const myTheme = defineTheme({
 *   root: 'grid gap-2',
 *   input: 'border px-3',
 *   helper: 'text-xs text-gray-500'
 * })
 *
 * const { ptMark } = usePassThrough(myTheme, props.pt)
 * ptMark('root')    // ✅ Autocomplete suggests: 'root' | 'input' | 'helper'
 * ptMark('invalid') // ❌ TypeScript error: Argument not assignable
 * ```
 *
 * @example With extend
 * ```ts
 * const theme = defineTheme({
 *   input: 'border rounded px-3 py-2',
 *   inputError: {
 *     extend: 'input',
 *     class: 'border-red-500'
 *   }
 * })
 * ```
 *
 * @example Nested components (with $merge for cascade)
 * ```ts
 * const theme = defineTheme({
 *   root: 'flex gap-4',
 *   badge: {
 *     $merge: true,  // Cascades to child component
 *     root: 'px-2 py-1 rounded',
 *     label: 'text-xs font-medium'
 *   }
 * })
 *
 * const { ptMark, ptFor } = usePassThrough(theme, props.pt)
 * const badgePt = ptFor('badge') // Typed nested pt spec with $merge cascaded
 * ```
 */
export function defineTheme<T extends PtSpec>(theme: T): T {
    return theme;
}

/**
 * Type helper to extract theme keys for better type checking
 *
 * Useful when you need to work with theme keys in a type-safe manner.
 *
 * @example
 * ```ts
 * const theme = defineTheme({
 *   root: 'grid',
 *   input: 'border',
 *   helper: 'text-xs'
 * })
 *
 * type MyThemeKeys = ThemeKeys<typeof theme> // 'root' | 'input' | 'helper'
 *
 * function customPtFunction(key: MyThemeKeys) {
 *   // key is now type-safe
 * }
 * ```
 */
export type ThemeKeys<T extends PtSpec> = keyof T & string;



// Internal utilities (exported for testing)
export const _internal = {
    processTheme,
    extractNestedPt,
    mergeSingleKeyAttr,
    mergeNestedAttr,
    ptAttrs
} as const;
