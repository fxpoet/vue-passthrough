import { describe, it, expect, vi } from 'vitest'
import { isString, isObject, isEmpty, warn, toClassObject, normalizeValue } from '../src/utils'

describe('Utility Functions', () => {
    // ============================================
    // isString tests
    // ============================================
    describe('isString', () => {
        it('returns true for strings', () => {
            expect(isString('hello')).toBe(true)
            expect(isString('')).toBe(true)
            expect(isString('123')).toBe(true)
        })

        it('returns false for numbers', () => {
            expect(isString(123)).toBe(false)
            expect(isString(0)).toBe(false)
            expect(isString(NaN)).toBe(false)
        })

        it('returns false for null and undefined', () => {
            expect(isString(null)).toBe(false)
            expect(isString(undefined)).toBe(false)
        })

        it('returns false for objects', () => {
            expect(isString({})).toBe(false)
            expect(isString({ key: 'value' })).toBe(false)
        })

        it('returns false for arrays', () => {
            expect(isString([])).toBe(false)
            expect(isString(['hello'])).toBe(false)
        })

        it('returns false for functions', () => {
            expect(isString(() => { })).toBe(false)
            expect(isString(function () { })).toBe(false)
        })

        it('returns false for booleans', () => {
            expect(isString(true)).toBe(false)
            expect(isString(false)).toBe(false)
        })
    })

    // ============================================
    // isObject tests
    // ============================================
    describe('isObject', () => {
        it('returns true for plain objects', () => {
            expect(isObject({})).toBe(true)
            expect(isObject({ key: 'value' })).toBe(true)
            expect(isObject({ nested: { key: 'value' } })).toBe(true)
        })

        it('returns false for arrays (critical for type safety)', () => {
            expect(isObject([])).toBe(false)
            expect(isObject([1, 2, 3])).toBe(false)
            expect(isObject(new Array())).toBe(false)
        })

        it('returns false for null', () => {
            expect(isObject(null)).toBe(false)
        })

        it('returns false for undefined', () => {
            expect(isObject(undefined)).toBe(false)
        })

        it('returns false for Date objects', () => {
            expect(isObject(new Date())).toBe(false)
        })

        it('returns false for RegExp objects', () => {
            expect(isObject(/test/)).toBe(false)
            expect(isObject(new RegExp('test'))).toBe(false)
        })

        it('returns false for Map objects', () => {
            expect(isObject(new Map())).toBe(false)
        })

        it('returns false for Set objects', () => {
            expect(isObject(new Set())).toBe(false)
        })

        it('returns false for strings', () => {
            expect(isObject('hello')).toBe(false)
        })

        it('returns false for numbers', () => {
            expect(isObject(123)).toBe(false)
            expect(isObject(0)).toBe(false)
        })

        it('returns false for booleans', () => {
            expect(isObject(true)).toBe(false)
            expect(isObject(false)).toBe(false)
        })

        it('returns false for functions', () => {
            expect(isObject(() => { })).toBe(false)
            expect(isObject(function () { })).toBe(false)
        })

        it('returns false for objects with custom prototypes', () => {
            class CustomClass { }
            expect(isObject(new CustomClass())).toBe(false)
        })
    })

    // ============================================
    // isEmpty tests
    // ============================================
    describe('isEmpty', () => {
        it('returns true for empty objects', () => {
            expect(isEmpty({})).toBe(true)
        })

        it('returns false for objects with properties', () => {
            expect(isEmpty({ a: 1 })).toBe(false)
            expect(isEmpty({ a: 1, b: 2 })).toBe(false)
        })

        it('returns false even if property value is undefined', () => {
            expect(isEmpty({ a: undefined })).toBe(false)
        })

        it('returns false for objects with null values', () => {
            expect(isEmpty({ a: null })).toBe(false)
        })

        it('returns false for objects with empty string values', () => {
            expect(isEmpty({ a: '' })).toBe(false)
        })

        it('returns false for objects with false values', () => {
            expect(isEmpty({ a: false })).toBe(false)
        })

        it('returns false for objects with zero values', () => {
            expect(isEmpty({ a: 0 })).toBe(false)
        })
    })

    // ============================================
    // toClassObject tests
    // ============================================
    describe('toClassObject', () => {
        it('converts string to class object', () => {
            const result = toClassObject('text-red-500')
            expect(result).toEqual({ class: 'text-red-500' })
        })

        it('handles multiple class names', () => {
            const result = toClassObject('grid gap-2 p-4')
            expect(result).toEqual({ class: 'grid gap-2 p-4' })
        })

        it('handles empty string', () => {
            const result = toClassObject('')
            expect(result).toEqual({ class: '' })
        })

        it('preserves whitespace', () => {
            const result = toClassObject('  text-sm  ')
            expect(result).toEqual({ class: '  text-sm  ' })
        })

        it('returns object with only class property', () => {
            const result = toClassObject('border')
            expect(Object.keys(result)).toEqual(['class'])
        })
    })

    // ============================================
    // normalizeValue tests
    // ============================================
    describe('normalizeValue', () => {
        it('converts string to class object', () => {
            const result = normalizeValue('text-red-500')
            expect(result).toEqual({ class: 'text-red-500' })
        })

        it('returns object as-is', () => {
            const input = { class: 'border', id: 'foo' }
            const result = normalizeValue(input)
            expect(result).toBe(input)
            expect(result).toEqual({ class: 'border', id: 'foo' })
        })

        it('returns empty object for null', () => {
            const result = normalizeValue(null)
            expect(result).toEqual({})
        })

        it('returns empty object for undefined', () => {
            const result = normalizeValue(undefined)
            expect(result).toEqual({})
        })

        it('returns empty object for numbers', () => {
            expect(normalizeValue(123)).toEqual({})
            expect(normalizeValue(0)).toEqual({})
            expect(normalizeValue(NaN)).toEqual({})
        })

        it('returns empty object for booleans', () => {
            expect(normalizeValue(true)).toEqual({})
            expect(normalizeValue(false)).toEqual({})
        })

        it('returns empty object for arrays', () => {
            expect(normalizeValue([])).toEqual({})
            expect(normalizeValue([1, 2, 3])).toEqual({})
        })

        it('returns empty object for Date objects', () => {
            expect(normalizeValue(new Date())).toEqual({})
        })

        it('returns empty object for Map objects', () => {
            expect(normalizeValue(new Map())).toEqual({})
        })

        it('returns empty object for Set objects', () => {
            expect(normalizeValue(new Set())).toEqual({})
        })

        it('returns empty object for functions', () => {
            expect(normalizeValue(() => {})).toEqual({})
            expect(normalizeValue(function() {})).toEqual({})
        })

        it('handles empty string', () => {
            const result = normalizeValue('')
            expect(result).toEqual({ class: '' })
        })

        it('handles complex nested objects', () => {
            const input = {
                class: 'border',
                id: 'test',
                onClick: () => {},
                style: { color: 'red' }
            }
            const result = normalizeValue(input)
            expect(result).toBe(input)
            expect(result).toHaveProperty('class')
            expect(result).toHaveProperty('id')
            expect(result).toHaveProperty('onClick')
            expect(result).toHaveProperty('style')
        })

        it('handles objects without class property', () => {
            const input = { id: 'foo', onClick: () => {} }
            const result = normalizeValue(input)
            expect(result).toBe(input)
            expect(result).toEqual({ id: 'foo', onClick: expect.any(Function) })
        })

        it('returns empty object for custom class instances', () => {
            class CustomClass {}
            expect(normalizeValue(new CustomClass())).toEqual({})
        })
    })

    // ============================================
    // warn tests
    // ============================================
    describe('warn', () => {
        it('logs warning with prefix', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            warn('Test warning')

            expect(consoleWarnSpy).toHaveBeenCalledWith('[vue-passthrough] Test warning')

            consoleWarnSpy.mockRestore()
        })

        it('logs warning with details as formatted JSON', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            warn('Test warning', { key: 'value', count: 42 })

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('[vue-passthrough] Test warning')
            )
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('"key": "value"')
            )
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('"count": 42')
            )

            consoleWarnSpy.mockRestore()
        })

        it('does not include details section if details is empty', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            warn('Test warning', {})

            expect(consoleWarnSpy).toHaveBeenCalledWith('[vue-passthrough] Test warning')

            consoleWarnSpy.mockRestore()
        })

        it('formats multiple details correctly', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            warn('Error occurred', {
                key: 'root',
                value: 123,
                nested: { a: 1, b: 2 }
            })

            const call = consoleWarnSpy.mock.calls[0][0]
            expect(call).toContain('[vue-passthrough] Error occurred')
            expect(call).toContain('"key": "root"')
            expect(call).toContain('"value": 123')
            expect(call).toContain('"nested"')

            consoleWarnSpy.mockRestore()
        })
    })
})
