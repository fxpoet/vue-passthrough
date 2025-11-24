import { useAttrs, computed, unref, type MaybeRef } from 'vue'
import { twMerge } from 'tailwind-merge';

// ============================================
// 타입 정의
// ============================================

export interface PtSpec {
    [key: string]: string | Record<string, any> | PtSpec | undefined;
}

// ============================================
// 유틸리티 함수
// ============================================

// 타입 체크 헬퍼
const isString = (value: any): value is string => typeof value === 'string';
const isObject = (value: any): value is Record<string, any> => value != null && typeof value === 'object';

// Theme 처리 결과 캐시 (메모리 누수 방지를 위해 WeakMap 사용)
const themeCache = new WeakMap<PtSpec, Record<string, Record<string, any>>>();

/**
 * Theme 처리: 정규화 + extend 해결을 한 번에 수행
 *
 * 1. 문자열 → { class: "..." } 변환
 * 2. extend 속성 처리 (순환 참조 감지)
 * 3. 결과 캐싱 (동일한 theme 객체에 대해 중복 처리 방지)
 *
 * @example
 * processTheme({
 *   root: "grid gap-2",                          // → { class: "grid gap-2" }
 *   input: { class: "border" },                  // → { class: "border" }
 *   inputInvalid: { extend: 'input', class: "red" }  // → { class: "border red" }
 * })
 */
function processTheme(theme: PtSpec): Record<string, Record<string, any>> {
    // 캐시 확인 (성능 최적화)
    const cached = themeCache.get(theme);
    if (cached) return cached;
    // 1단계: 정규화 (문자열 → 객체)
    const normalized: Record<string, Record<string, any>> = {};

    for (const key in theme) {
        const value = theme[key];

        if (isString(value)) {
            normalized[key] = { class: value };
        } else if (isObject(value)) {
            normalized[key] = value;
        }
    }

    // 2단계: extend 해결 (순환 참조 감지)
    const result: Record<string, Record<string, any>> = {};
    const resolving = new Set<string>();  // 현재 해결 중인 키 추적

    /**
     * extend를 재귀적으로 해결하는 헬퍼 함수
     * @returns 해결된 속성 또는 null (순환 참조 시)
     */
    const resolveExtend = (key: string): Record<string, any> | null => {
        // 이미 해결된 경우
        if (key in result) return result[key] || null;

        const value = normalized[key];
        if (!value) return null;

        // extend가 없으면 그대로 반환
        if (!('extend' in value)) {
            result[key] = value;
            return value;
        }

        // 순환 참조 감지
        if (resolving.has(key)) {
            console.warn(`[PT] Circular reference detected: "${key}" - ignoring extend.`);
            const { extend, ...withoutExtend } = value;
            result[key] = withoutExtend;
            return withoutExtend;
        }

        // 해결 시작
        resolving.add(key);

        const { extend, class: extendClass, ...rest } = value;
        const baseAttrs = resolveExtend(extend as string);

        // extend 대상이 없거나 순환 참조로 실패한 경우
        if (!baseAttrs) {
            console.warn(`[PT] Extend target "${extend}" not found: "${key}"`);
            result[key] = { ...rest, class: extendClass || '' };
            resolving.delete(key);
            return result[key];
        }

        const { class: baseClass, ...baseRest } = baseAttrs;

        // extend 대상을 병합
        result[key] = {
            ...baseRest,
            ...rest,
            class: twMerge(baseClass || '', extendClass || '')
        };

        resolving.delete(key);
        return result[key];
    };

    // 모든 키에 대해 extend 해결
    for (const key in normalized) {
        resolveExtend(key);
    }

    // 캐시에 저장 (다음 호출 시 재사용)
    themeCache.set(theme, result);

    return result;
}

// ============================================
// Core 함수
// ============================================

/**
 * attrs에서 pt 관련 속성 추출
 *
 * 지원 형식:
 * - :pt="{ root: 'class' }" → 객체 형태
 * - pt:root="class" → shorthand (단일 키)
 * - pt:root:class="value" → 중첩 속성 (class, id, onClick 등)
 */
export function attrsToPt(): PtSpec {
    const attrs = useAttrs()
    let pt = {} as PtSpec;

    for (const attrKey in attrs) {
        // :pt="{ ... }" 형태 처리
        if (attrKey === 'pt') {
            const ptValue = attrs[attrKey];
            if (isObject(ptValue)) {
                pt = mergePt(pt, ptValue as PtSpec);
            }
            continue;
        }

        // pt:로 시작하지 않으면 스킵
        if (!attrKey.startsWith('pt:')) continue;

        const keys = attrKey.slice(3).split(':');
        const value = attrs[attrKey];
        let current: any = pt;

        // pt:root="text" 형태 → { root: { class: "text" } }
        if (keys.length === 1) {
            const key = keys[0];
            if (!key) continue;

            if (!(key in current)) {
                current[key] = {};
            }

            if (isObject(current[key])) {
                current[key].class = current[key].class
                    ? twMerge(current[key].class, value as string)
                    : value;
            } else {
                current[key] = { class: value };
            }
            continue;
        }

        // pt:root:class="text" 형태 → 중첩 객체 생성
        // 마지막 키 전까지 중첩 객체 생성
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!key) continue;

            if (!(key in current) || !isObject(current[key])) {
                current[key] = {};
            }
            current = current[key];
        }

        // 마지막 키에 값 할당
        const lastKey = keys[keys.length - 1];
        if (lastKey) {
            current[lastKey] = value;
        }
    }

    return pt;
}

/**
 * 두 PtSpec 객체를 병합
 *
 * 병합 규칙:
 * 1. 문자열은 class shorthand로 취급 ({ class: "..." }로 변환)
 * 2. class 속성은 twMerge로 병합 (중복 제거)
 * 3. 다른 속성은 spread로 병합 (pt2가 우선)
 * 4. class가 없는 중첩 객체는 재귀적으로 병합
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

        // pt2 값이 없으면 스킵
        if (!val2) continue;

        // pt1 값이 없으면 pt2 값을 그대로 사용
        if (!val1) {
            result[key] = val2;
            continue;
        }

        // 문자열은 class shorthand로 취급 → 객체로 변환 후 병합
        const normalized1 = isString(val1) ? { class: val1 } : val1;
        const normalized2 = isString(val2) ? { class: val2 } : val2;

        // 둘 다 객체인 경우
        if (isObject(normalized1) && isObject(normalized2)) {
            const hasClass = 'class' in normalized1 || 'class' in normalized2;

            if (hasClass) {
                // class 속성이 있으면 HTML 속성 객체로 간주
                // class 중복 방지: 수동으로 분리 후 병합
                const { class: class1, ...rest1 } = normalized1;
                const { class: class2, ...rest2 } = normalized2;

                result[key] = {
                    ...rest1,
                    ...rest2,
                    class: twMerge(class1 || '', class2 || '')
                };
            } else {
                // class가 없으면 중첩 PtSpec으로 간주하여 재귀 병합
                result[key] = mergePt(normalized1 as PtSpec, normalized2 as PtSpec);
            }
        }
        else {
            // 하나라도 객체가 아니면 pt2 값으로 덮어쓰기
            result[key] = val2;
        }
    }

    return result;
}

/**
 * theme의 base 속성과 pt를 병합하여 최종 HTML 속성 반환
 *
 * @param key - 엘리먼트 키 (예: 'root', 'input', 'helper')
 * @param baseAttrs - theme에서 온 기본 속성
 * @param pt - 사용자가 전달한 pt (props.pt 또는 attrs)
 * @returns 병합된 HTML 속성 (v-bind에 전달)
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

    // pt에 해당 키가 없으면 base 속성만 반환
    if (!ptValue) return baseAttrs;

    // baseAttrs에서 class 분리 (중복 방지 위해)
    const { class: baseClass, ...baseRest } = baseAttrs;

    // 문자열인 경우 (class shorthand)
    if (isString(ptValue)) {
        return {
            ...baseRest,
            class: twMerge(baseClass || '', ptValue)
        };
    }

    // 객체인 경우
    if (isObject(ptValue)) {
        const { class: ptClass, ...ptRest } = ptValue;
        return {
            ...baseRest,
            ...ptRest,  // pt의 다른 속성 병합 (id, onClick 등)
            class: twMerge(baseClass || '', ptClass || '')  // class는 twMerge로 병합
        };
    }

    return baseAttrs;
}

// ============================================
// Composable: usePassThrough
// ============================================

/**
 * PassThrough 시스템: 컴포넌트 스타일 커스터마이징
 *
 * 3가지 소스에서 스타일을 병합:
 * 1. theme (컴포넌트 기본 스타일)
 * 2. attrs (부모에서 pt:root="..." 형태로 전달)
 * 3. propsPt (부모에서 :pt="{ root: '...' }" 형태로 전달)
 *
 * 병합 우선순위: theme < attrs < propsPt
 *
 * @param theme - 기본 테마 (플랫 구조, 문자열은 자동으로 class로 변환)
 * @param propsPt - props.pt (선택사항, MaybeRef로 reactivity 자동 처리)
 *
 * @example
 * const { pt } = usePassThrough({
 *   root: "grid gap-2",
 *   input: "border px-3",
 *   inputInvalid: { extend: 'input', class: "border-red-500" },
 *   helper: "text-xs"
 * }, props.pt)
 */
export function usePassThrough(
    theme: PtSpec,
    propsPt?: MaybeRef<PtSpec>
) {
    // 1. attrs에서 pt 추출 (computed로 반응성 유지)
    //    예: pt:root="bg-red-500" → { root: { class: "bg-red-500" } }
    const attrsPt = computed(() => attrsToPt());

    // 2. theme 처리: 정규화 + extend 해결 (초기화 시 1번만 실행 - 성능 최적화)
    //    문자열 → 객체 변환, extend 속성 처리
    const normalizedTheme = processTheme(theme);

    // 3. propsPt를 computed로 unwrap (reactivity 유지)
    const resolvedPropsPt = computed(() => unref(propsPt) || {});

    // 4. 최종 pt (디버깅용): props.pt replaces, attrs merges
    //    - propsPt에 키가 있으면: propsPt[key]만 사용 (replace)
    //    - propsPt에 키가 없으면: attrsPt[key] 사용 (merge with theme)
    const debugPt = computed(() => {
        const result: PtSpec = { ...attrsPt.value };
        const propsValue = resolvedPropsPt.value;

        // propsPt에 있는 키는 attrsPt를 무시하고 replace
        for (const key in propsValue) {
            result[key] = propsValue[key];
        }

        return result;
    });

    /**
     * pt 함수: v-bind에 사용할 HTML 속성 반환
     *
     * Replace vs Merge 전략:
     * - propsPt에 키가 있으면: theme 무시하고 propsPt만 사용 (REPLACE)
     * - propsPt에 키가 없으면: theme + attrsPt 병합 (MERGE)
     */
    const pt = (key: string): Record<string, any> => {
        const propsValue = resolvedPropsPt.value;

        // propsPt에 키가 있으면 theme 무시 (REPLACE)
        if (key in propsValue) {
            const ptValue = propsValue[key];

            // 문자열인 경우 (class shorthand)
            if (isString(ptValue)) {
                return { class: ptValue };
            }

            // 객체인 경우
            if (isObject(ptValue)) {
                return ptValue as Record<string, any>;
            }

            return {};
        }

        // propsPt에 키가 없으면 theme + attrsPt 병합 (MERGE)
        const baseAttrs = normalizedTheme[key] || {};
        return ptAttrs(key, baseAttrs, attrsPt.value);
    };

    /**
     * 하위 컴포넌트로 pt 전달 헬퍼
     *
     * class 속성이 없는 중첩 객체만 추출하여 하위 컴포넌트에 전달
     * Replace 전략 적용: propsPt에 키가 있으면 theme 무시, 없으면 theme 사용
     *
     * @example
     * // Button 컴포넌트에서
     * <Badge :pt="ptFor('badge')" />
     */
    const ptFor = (componentKey: string): PtSpec => {
        const propsValue = resolvedPropsPt.value;

        // 중첩 PtSpec 추출 헬퍼 (class가 없으면 중첩 객체로 간주)
        const getNestedPt = (val: any): PtSpec => {
            if (!val) return {};
            if (isObject(val) && !('class' in val)) {
                return val as PtSpec;
            }
            return {};
        };

        // propsPt에 키가 있으면 theme 무시 (REPLACE)
        if (componentKey in propsValue) {
            return getNestedPt(propsValue[componentKey]);
        }

        // propsPt에 키가 없으면 theme + attrs 사용
        // attrs는 이미 debugPt에 반영되어 있음
        const attrsValue = attrsPt.value[componentKey];
        if (attrsValue) {
            const nested = getNestedPt(attrsValue);
            if (Object.keys(nested).length > 0) {
                return nested;
            }
        }

        // attrs에도 없으면 theme 사용
        const themeValue = normalizedTheme[componentKey];
        return getNestedPt(themeValue);
    };

    return {
        /**
         * v-bind에 사용할 pt 함수 (완전한 reactivity)
         * @example v-bind="pt('root')"
         */
        pt,

        /**
         * 하위 컴포넌트로 pt 전달
         * @example <Badge :pt="ptFor('badge')" />
         */
        ptFor,

        /**
         * 최종 병합된 pt 스펙 (디버깅용)
         */
        debugPt
    };
}

// 별칭 (더 짧게 사용하고 싶은 경우)
export const usePt = usePassThrough;
