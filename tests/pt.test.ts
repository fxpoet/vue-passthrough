import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick, defineComponent, computed } from 'vue'
import { mount } from '@vue/test-utils'
import { mergePt, usePassThrough, attrsToPt } from '../src/pt'
import type { PtSpec } from '../src/pt'

describe('PassThrough System', () => {
    // ============================================
    // attrsToPt tests (attrs extraction and parsing)
    // ============================================
    describe('attrsToPt', () => {
        it('returns empty object when no pt attrs present', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    expect(result).toEqual({})
                }
            })

            mount(TestComponent, {
                attrs: {
                    'class': 'some-class',
                    'id': 'test-id'
                }
            })
        })

        it('parses single key pt attribute (pt:root="class")', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    expect(result.root).toEqual({ class: 'bg-red-500' })
                }
            })

            mount(TestComponent, {
                attrs: {
                    'pt:root': 'bg-red-500'
                }
            })
        })

        it('parses multiple single key pt attributes', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    expect(result.root).toEqual({ class: 'grid gap-2' })
                    expect(result.input).toEqual({ class: 'border' })
                    expect(result.helper).toEqual({ class: 'text-xs' })
                }
            })

            mount(TestComponent, {
                attrs: {
                    'pt:root': 'grid gap-2',
                    'pt:input': 'border',
                    'pt:helper': 'text-xs'
                }
            })
        })

        it('parses nested pt attributes (pt:root:id="value")', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    expect(result.root).toEqual({
                        id: 'custom-id',
                        'data-test': 'test-value'
                    })
                }
            })

            mount(TestComponent, {
                attrs: {
                    'pt:root:id': 'custom-id',
                    'pt:root:data-test': 'test-value'
                }
            })
        })

        it('merges single key and nested attributes for same key', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    expect(result.root).toHaveProperty('class')
                    expect(result.root).toHaveProperty('id')
                    expect((result.root as any).class).toContain('bg-blue-500')
                    expect((result.root as any).id).toBe('test-id')
                }
            })

            mount(TestComponent, {
                attrs: {
                    'pt:root': 'bg-blue-500',
                    'pt:root:id': 'test-id'
                }
            })
        })

        it('handles multiple class values in single pt attribute', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    expect(result.root).toHaveProperty('class')
                    // Multiple classes in single attribute
                    const className = (result.root as any).class
                    expect(className).toContain('bg-red-500')
                    expect(className).toContain('p-4')
                    expect(className).toContain('text-white')
                }
            })

            mount(TestComponent, {
                attrs: {
                    'pt:root': 'bg-red-500 p-4 text-white'
                }
            })
        })

        it('parses object-style :pt attribute', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    expect(result.root).toBeDefined()
                    expect(result.input).toBeDefined()
                }
            })

            mount(TestComponent, {
                attrs: {
                    pt: {
                        root: 'grid gap-2',
                        input: { class: 'border', id: 'input-id' }
                    }
                }
            })
        })

        it('merges :pt object with pt:* attributes (pt:* has priority)', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    // pt:root should merge with :pt root
                    expect(result.root).toHaveProperty('class')
                    const className = (result.root as any).class
                    expect(className).toContain('grid')
                    expect(className).toContain('bg-red-500')
                }
            })

            mount(TestComponent, {
                attrs: {
                    pt: {
                        root: 'grid gap-2',
                        helper: 'text-xs'
                    },
                    'pt:root': 'bg-red-500'
                }
            })
        })

        it('ignores non-object :pt values', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    expect(result).toEqual({ helper: { class: 'text-xs' } })
                }
            })

            mount(TestComponent, {
                attrs: {
                    pt: 'invalid-string-value',
                    'pt:helper': 'text-xs'
                }
            })
        })

        it('handles empty string values', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    expect(result.root).toEqual({ class: '' })
                }
            })

            mount(TestComponent, {
                attrs: {
                    'pt:root': ''
                }
            })
        })

        it('handles deeply nested attributes (pt:root:style:color)', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    expect(result.root).toBeDefined()
                    expect((result.root as any).style).toBeDefined()
                    expect((result.root as any).style.color).toBe('red')
                }
            })

            mount(TestComponent, {
                attrs: {
                    'pt:root:style:color': 'red'
                }
            })
        })

        it('handles event handlers in pt attributes', () => {
            const onClick = vi.fn()

            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    expect(result.root).toHaveProperty('onClick')
                    expect(typeof (result.root as any).onClick).toBe('function')
                }
            })

            mount(TestComponent, {
                attrs: {
                    'pt:root:onClick': onClick
                }
            })
        })

        it('preserves complex object values', () => {
            const complexValue = { nested: { deep: 'value' } }

            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const result = attrsToPt()
                    expect(result.root).toHaveProperty('data')
                    expect((result.root as any).data).toEqual(complexValue)
                }
            })

            mount(TestComponent, {
                attrs: {
                    'pt:root:data': complexValue
                }
            })
        })
    })

    // ============================================
    // mergePt tests (pure function tests)
    // ============================================
    describe('mergePt', () => {
        it('merges string shorthand', () => {
            const result = mergePt(
                { root: 'grid gap-2' },
                { root: 'bg-white' }
            )

            expect(result.root).toHaveProperty('class')
            expect((result.root as any).class).toContain('grid')
            expect((result.root as any).class).toContain('bg-white')
        })

        it('merges object-style classes with twMerge', () => {
            const result = mergePt(
                { root: { class: 'text-sm text-red-500' } },
                { root: { class: 'text-lg text-blue-500' } }
            )

            // twMerge removes conflicting classes (text-sm → text-lg, text-red-500 → text-blue-500)
            expect((result.root as any).class).toBe('text-lg text-blue-500')
        })

        it('merges other HTML attributes together', () => {
            const result = mergePt(
                { root: { class: 'border', id: 'old-id' } },
                { root: { class: 'rounded', onClick: () => { } } }
            )

            expect(result.root).toHaveProperty('class')
            expect(result.root).toHaveProperty('onClick')
            expect((result.root as any).id).toBe('old-id')
        })

        it('keeps keys that exist only in pt1', () => {
            const result = mergePt(
                { root: 'grid', helper: 'text-xs' },
                { root: 'gap-2' }
            )

            expect(result.root).toBeDefined()
            expect(result.helper).toBeDefined()
        })

        it('adds keys that exist only in pt2', () => {
            const result = mergePt(
                { root: 'grid' },
                { helper: 'text-xs' }
            )

            expect(result.root).toBeDefined()
            expect(result.helper).toBeDefined()
        })

        it('recursively merges nested objects (when no class)', () => {
            const result = mergePt(
                { badge: { label: 'text-sm' } },
                { badge: { icon: 'w-4 h-4' } }
            )

            expect((result.badge as any).label).toBeDefined()
            expect((result.badge as any).icon).toBeDefined()
        })
    })

    // ============================================
    // Tailwind-merge and mergeProps integration tests
    // ============================================
    describe('tailwind-merge integration', () => {
        it('resolves conflicting Tailwind classes (padding)', () => {
            const result = mergePt(
                { root: { class: 'px-2 py-3' } },
                { root: { class: 'px-4' } }
            )

            // px-4 should override px-2
            expect((result.root as any).class).toContain('px-4')
            expect((result.root as any).class).not.toContain('px-2')
            expect((result.root as any).class).toContain('py-3')
        })

        it('resolves conflicting Tailwind classes (text size)', () => {
            const result = mergePt(
                { root: { class: 'text-sm font-bold' } },
                { root: { class: 'text-lg' } }
            )

            // text-lg should override text-sm
            expect((result.root as any).class).toContain('text-lg')
            expect((result.root as any).class).not.toContain('text-sm')
            expect((result.root as any).class).toContain('font-bold')
        })

        it('resolves conflicting Tailwind classes (background)', () => {
            const result = mergePt(
                { root: { class: 'bg-red-500 text-white' } },
                { root: { class: 'bg-blue-600' } }
            )

            // bg-blue-600 should override bg-red-500
            expect((result.root as any).class).toContain('bg-blue-600')
            expect((result.root as any).class).not.toContain('bg-red-500')
            expect((result.root as any).class).toContain('text-white')
        })

        it('chains event handlers with mergeProps', () => {
            const handler1 = vi.fn()
            const handler2 = vi.fn()

            const result = mergePt(
                { root: { class: 'border', onClick: handler1 } },
                { root: { class: 'rounded', onClick: handler2 } }
            )

            // Both handlers should be in the result
            const onClick = (result.root as any).onClick
            expect(onClick).toBeDefined()

            // Call the merged handler
            if (Array.isArray(onClick)) {
                onClick.forEach((fn: any) => fn())
            } else if (typeof onClick === 'function') {
                onClick()
            }

            // Both handlers should have been called
            expect(handler1).toHaveBeenCalled()
            expect(handler2).toHaveBeenCalled()
        })

        it('merges style objects', () => {
            const result = mergePt(
                { root: { class: 'border', style: { color: 'red' } } },
                { root: { class: 'rounded', style: { fontSize: '12px' } } }
            )

            const style = (result.root as any).style
            expect(style).toBeDefined()
            expect(style.color).toBe('red')
            expect(style.fontSize).toBe('12px')
        })

        it('preserves non-conflicting attributes', () => {
            const result = mergePt(
                { root: { class: 'border', id: 'root-id', 'data-test': 'test1' } },
                { root: { class: 'rounded', title: 'Root Element' } }
            )

            const root = result.root as any
            expect(root.id).toBe('root-id')
            expect(root['data-test']).toBe('test1')
            expect(root.title).toBe('Root Element')
            expect(root.class).toContain('border')
            expect(root.class).toContain('rounded')
        })

        it('handles multiple event handlers in usePassThrough', () => {
            const themeHandler = vi.fn()
            const attrHandler = vi.fn()

            const TestComponent = defineComponent({
                template: '<div v-bind="pt(\'root\')" data-testid="root">test</div>',
                setup() {
                    const { pt } = usePassThrough({
                        root: { class: 'border', onClick: themeHandler }
                    })
                    return { pt }
                }
            })

            const wrapper = mount(TestComponent, {
                attrs: {
                    'pt:root:onClick': attrHandler
                }
            })

            wrapper.find('[data-testid="root"]').trigger('click')

            // Both handlers should be called
            expect(themeHandler).toHaveBeenCalled()
            expect(attrHandler).toHaveBeenCalled()
        })

        it('applies tailwind-merge in usePassThrough with conflicting classes', () => {
            const TestComponent = defineComponent({
                template: '<div v-bind="pt(\'root\')" data-testid="root">test</div>',
                setup() {
                    const { pt } = usePassThrough({
                        root: 'px-2 py-4 bg-red-500'
                    })
                    return { pt }
                }
            })

            const wrapper = mount(TestComponent, {
                attrs: {
                    'pt:root': 'px-6 bg-blue-600'
                }
            })

            const rootEl = wrapper.find('[data-testid="root"]').element as HTMLElement

            // px-6 should override px-2, bg-blue-600 should override bg-red-500
            expect(rootEl.className).toContain('px-6')
            expect(rootEl.className).not.toContain('px-2')
            expect(rootEl.className).toContain('bg-blue-600')
            expect(rootEl.className).not.toContain('bg-red-500')
            // py-4 should remain (no conflict)
            expect(rootEl.className).toContain('py-4')
        })

        it('applies tailwind-merge with props.pt replacement', () => {
            const TestComponent = defineComponent({
                props: {
                    customPt: {
                        type: Object as () => PtSpec,
                        default: () => ({})
                    }
                },
                template: '<div v-bind="ptFunc(\'root\')" data-testid="root">test</div>',
                setup(props) {
                    const { pt } = usePassThrough({
                        root: 'px-2 py-4'
                    }, computed(() => props.customPt))
                    return { ptFunc: pt }
                }
            })

            const wrapper = mount(TestComponent, {
                props: {
                    customPt: { root: 'px-6 py-2 bg-blue-600' }
                }
            })

            const rootEl = wrapper.find('[data-testid="root"]').element as HTMLElement

            // props.pt replaces theme completely (no merge)
            // But within props.pt itself, if there were conflicts, tailwind-merge would resolve them
            expect(rootEl.className).toContain('px-6')
            expect(rootEl.className).toContain('py-2')
            expect(rootEl.className).toContain('bg-blue-600')
            expect(rootEl.className).not.toContain('px-2')
            expect(rootEl.className).not.toContain('py-4')
        })
    })

    // ============================================
    // usePassThrough + attrs integration tests
    // ============================================
    describe('attrs integration tests (pt:root, etc.)', () => {
        it('pt:root="class" format is merged with theme', () => {
            const TestComponent = defineComponent({
                template: '<div v-bind="pt(\'root\')">test</div>',
                setup() {
                    const { pt } = usePassThrough({
                        root: 'grid gap-2'
                    })
                    return { pt }
                }
            })

            const wrapper = mount(TestComponent, {
                attrs: {
                    'pt:root': 'bg-red-500'
                }
            })

            const rootEl = wrapper.element as HTMLElement
            expect(rootEl.className).toContain('grid')
            expect(rootEl.className).toContain('gap-2')
            expect(rootEl.className).toContain('bg-red-500')
        })

        it('passes other HTML attributes in pt:root:id="value" format', () => {
            const TestComponent = defineComponent({
                template: '<div v-bind="pt(\'root\')">test</div>',
                setup() {
                    const { pt } = usePassThrough({
                        root: 'grid'
                    })
                    return { pt }
                }
            })

            const wrapper = mount(TestComponent, {
                attrs: {
                    'pt:root:id': 'custom-id',
                    'pt:root:data-test': 'value'
                }
            })

            const rootEl = wrapper.element as HTMLElement
            expect(rootEl.id).toBe('custom-id')
            expect(rootEl.getAttribute('data-test')).toBe('value')
        })

        it('passes event handlers in pt:root:onClick format', () => {
            const onClick = vi.fn()

            const TestComponent = defineComponent({
                template: '<div v-bind="pt(\'root\')">test</div>',
                setup() {
                    const { pt } = usePassThrough({
                        root: 'cursor-pointer'
                    })
                    return { pt }
                }
            })

            const wrapper = mount(TestComponent, {
                attrs: {
                    'pt:root:onClick': onClick
                }
            })

            wrapper.find('div').trigger('click')
            expect(onClick).toHaveBeenCalled()
        })

        it('reactivity: updates when attrs pt:* values change', async () => {
            const dynamicClass = ref('bg-red-500')

            const ChildComponent = defineComponent({
                template: '<div v-bind="pt(\'root\')" data-testid="child">child</div>',
                setup() {
                    const { pt } = usePassThrough({
                        root: 'grid gap-2'
                    })
                    return { pt }
                }
            })

            const ParentComponent = defineComponent({
                components: { ChildComponent },
                template: `<ChildComponent :pt:root="dynamicClass" />`,
                setup() {
                    return { dynamicClass }
                }
            })

            const wrapper = mount(ParentComponent)
            const childEl = wrapper.find('[data-testid="child"]').element as HTMLElement

            // Initial state: theme + dynamicClass
            expect(childEl.className).toContain('grid')
            expect(childEl.className).toContain('gap-2')
            expect(childEl.className).toContain('bg-red-500')

            // Change ref value
            dynamicClass.value = 'bg-blue-500 p-4'
            await nextTick()

            // Should update to new value
            expect(childEl.className).toContain('grid')
            expect(childEl.className).toContain('gap-2')
            expect(childEl.className).toContain('bg-blue-500')
            expect(childEl.className).toContain('p-4')
            expect(childEl.className).not.toContain('bg-red-500')
        })

        it('reactivity: updates when attrs :pt object values change', async () => {
            const dynamicPt = ref<Record<string, any>>({ root: 'bg-red-500' })

            const ChildComponent = defineComponent({
                template: '<div v-bind="pt(\'root\')" data-testid="child">child</div>',
                setup() {
                    const { pt } = usePassThrough({
                        root: 'grid gap-2'
                    })
                    return { pt }
                }
            })

            const ParentComponent = defineComponent({
                components: { ChildComponent },
                template: `<ChildComponent :pt="dynamicPt" />`,
                setup() {
                    return { dynamicPt }
                }
            })

            const wrapper = mount(ParentComponent)
            const childEl = wrapper.find('[data-testid="child"]').element as HTMLElement

            // Initial state: theme + dynamicPt
            expect(childEl.className).toContain('grid')
            expect(childEl.className).toContain('gap-2')
            expect(childEl.className).toContain('bg-red-500')

            // Change ref value
            dynamicPt.value = { root: 'bg-blue-500 p-4' }
            await nextTick()

            // Should update to new value
            expect(childEl.className).toContain('grid')
            expect(childEl.className).toContain('gap-2')
            expect(childEl.className).toContain('bg-blue-500')
            expect(childEl.className).toContain('p-4')
            expect(childEl.className).not.toContain('bg-red-500')
        })

        it('reactivity: pt:* attrs merge additively while :pt replaces', async () => {
            const attrsClass = ref('text-sm')
            const propsPt = ref<PtSpec | undefined>(undefined)

            const ChildComponent = defineComponent({
                props: {
                    pt: {
                        type: Object as () => PtSpec | undefined,
                        default: undefined
                    }
                },
                template: '<div v-bind="ptFunc(\'root\')" data-testid="child">child</div>',
                setup(props) {
                    const { pt } = usePassThrough({
                        root: 'grid gap-2'
                    }, computed(() => props.pt))
                    return { ptFunc: pt }
                }
            })

            const ParentComponent = defineComponent({
                components: { ChildComponent },
                template: `<ChildComponent :pt:root="attrsClass" :pt="propsPt" />`,
                setup() {
                    return { attrsClass, propsPt }
                }
            })

            const wrapper = mount(ParentComponent)
            const childEl = wrapper.find('[data-testid="child"]').element as HTMLElement

            // Initial: attrs merge with theme
            expect(childEl.className).toContain('grid')
            expect(childEl.className).toContain('gap-2')
            expect(childEl.className).toContain('text-sm')

            // Change to props.pt (should replace, not merge)
            propsPt.value = { root: 'flex flex-row' }
            await nextTick()

            // props.pt replaces everything
            expect(childEl.className).toBe('flex flex-row')
            expect(childEl.className).not.toContain('grid')
            expect(childEl.className).not.toContain('text-sm')

            // Remove props.pt, attrs should work again
            propsPt.value = undefined
            await nextTick()

            // Back to theme + attrs merge
            expect(childEl.className).toContain('grid')
            expect(childEl.className).toContain('gap-2')
            expect(childEl.className).toContain('text-sm')
        })
    })

    // ============================================
    // usePassThrough integration tests
    // ============================================
    describe('usePassThrough', () => {
        it('converts theme strings to { class: ... } objects', () => {
            const TestComponent = defineComponent({
                template: '<div v-bind="pt(\'root\')">test</div>',
                setup() {
                    const { pt } = usePassThrough({
                        root: 'grid gap-2'
                    })
                    return { pt }
                }
            })

            const wrapper = mount(TestComponent)
            const rootEl = wrapper.element as HTMLElement

            expect(rootEl.className).toContain('grid')
            expect(rootEl.className).toContain('gap-2')
        })

        it('correctly resolves extend attribute', () => {
            const TestComponent = defineComponent({
                template: `
          <div>
            <div v-bind="pt('input')" data-testid="input">input</div>
            <div v-bind="pt('inputInvalid')" data-testid="invalid">invalid</div>
          </div>
        `,
                setup() {
                    const { pt } = usePassThrough({
                        input: 'border px-3',
                        inputInvalid: {
                            extend: 'input',
                            class: 'border-red-500'
                        }
                    })
                    return { pt }
                }
            })

            const wrapper = mount(TestComponent)
            const input = wrapper.find('[data-testid="input"]').element as HTMLElement
            const invalid = wrapper.find('[data-testid="invalid"]').element as HTMLElement

            // input has default styles
            expect(input.className).toContain('border')
            expect(input.className).toContain('px-3')

            // inputInvalid extends input + additional styles
            expect(invalid.className).toContain('border')
            expect(invalid.className).toContain('px-3')
            expect(invalid.className).toContain('border-red-500')
        })

        it('props.pt replaces theme', () => {
            const TestComponent = defineComponent({
                props: {
                    customPt: {
                        type: Object as () => PtSpec,
                        default: () => ({})
                    }
                },
                template: '<div v-bind="ptFunc(\'root\')">test</div>',
                setup(props) {
                    const { pt } = usePassThrough({
                        root: 'grid gap-2'
                    }, computed(() => props.customPt))
                    return { ptFunc: pt }
                }
            })

            const wrapper = mount(TestComponent, {
                props: {
                    customPt: { root: 'bg-blue-500' }
                }
            })

            const rootEl = wrapper.element as HTMLElement
            // In props.pt, so ignore theme and replace
            expect(rootEl.className).toBe('bg-blue-500')
            expect(rootEl.className).not.toContain('grid')
        })

        it('reactivity: updates when props.pt changes', async () => {
            const propsPt = ref<PtSpec>({ root: 'bg-red-500' })

            const TestComponent = defineComponent({
                template: '<div v-bind="ptFunc(\'root\')">test</div>',
                setup() {
                    const { pt } = usePassThrough({
                        root: 'grid gap-2'
                    }, propsPt)
                    return { ptFunc: pt }
                }
            })

            const wrapper = mount(TestComponent)
            const rootEl = wrapper.element as HTMLElement

            expect(rootEl.className).toContain('bg-red-500')

            // Change props.pt
            propsPt.value = { root: 'bg-blue-500' }
            await nextTick()

            expect(rootEl.className).toContain('bg-blue-500')
            expect(rootEl.className).not.toContain('bg-red-500')
        })

        it('priority: theme < attrs < propsPt', () => {
            const TestComponent = defineComponent({
                props: {
                    customPt: {
                        type: Object as () => PtSpec,
                        default: () => ({})
                    }
                },
                template: '<div v-bind="ptFunc(\'root\')">test</div>',
                setup(props) {
                    const { pt } = usePassThrough({
                        root: 'text-sm'  // theme
                    }, computed(() => props.customPt))
                    return { ptFunc: pt }
                }
            })

            const wrapper = mount(TestComponent, {
                attrs: {
                    'pt:root': 'text-base'  // attrs
                },
                props: {
                    customPt: { root: 'text-lg' }  // propsPt (replace)
                }
            })

            const rootEl = wrapper.element as HTMLElement
            // In propsPt, so ignore theme and replace
            expect(rootEl.className).toBe('text-lg')
        })

        it('props.pt replaces, attrs merges', () => {
            const TestComponent = defineComponent({
                props: {
                    customPt: {
                        type: Object as () => PtSpec,
                        default: () => ({})
                    }
                },
                template: `
          <div>
            <div v-bind="pt('root')" data-testid="root">root</div>
            <div v-bind="pt('helper')" data-testid="helper">helper</div>
          </div>
        `,
                setup(props) {
                    const { pt } = usePassThrough({
                        root: 'grid gap-2',
                        helper: 'text-xs mt-1'
                    }, computed(() => props.customPt))
                    return { pt }
                }
            })

            const wrapper = mount(TestComponent, {
                attrs: {
                    'pt:helper': 'text-blue-500'  // attrs (merge, non-conflicting classes)
                },
                props: {
                    customPt: { root: 'flex flex-row' }  // props (replace)
                }
            })

            const root = wrapper.find('[data-testid="root"]').element as HTMLElement
            const helper = wrapper.find('[data-testid="helper"]').element as HTMLElement

            // root is in props.pt, so ignore theme and replace
            expect(root.className).toBe('flex flex-row')
            expect(root.className).not.toContain('grid')

            // helper is not in props.pt, so merge theme + attrs
            expect(helper.className).toContain('text-xs')
            expect(helper.className).toContain('mt-1')
            expect(helper.className).toContain('text-blue-500')
        })

        it('detects circular references and warns', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    usePassThrough({
                        a: { extend: 'b', class: 'a-class' },
                        b: { extend: 'a', class: 'b-class' }
                    })
                }
            })

            mount(TestComponent)

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Circular reference detected')
            )

            consoleWarnSpy.mockRestore()
        })

        it('warns when extend key does not exist', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    usePassThrough({
                        inputInvalid: {
                            extend: 'nonExistent',
                            class: 'border-red-500'
                        }
                    })
                }
            })

            mount(TestComponent)

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Extend target "nonExistent" not found')
            )

            consoleWarnSpy.mockRestore()
        })

        it('passes pt to child components with ptFor', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const { ptFor } = usePassThrough({
                        root: 'grid',
                        badge: {
                            label: 'text-xs',
                            icon: 'w-4'
                        }
                    })

                    const badgePt = ptFor('badge')

                    expect(badgePt).toHaveProperty('label')
                    expect(badgePt).toHaveProperty('icon')
                    expect(badgePt).not.toHaveProperty('class')
                }
            })

            mount(TestComponent)
        })

        it('prevents reprocessing with theme caching', () => {
            const theme = {
                root: 'grid gap-2',
                input: 'border'
            }

            // First call
            const TestComponent1 = defineComponent({
                template: '<div>test1</div>',
                setup() {
                    usePassThrough(theme)
                }
            })

            mount(TestComponent1)

            // Second call (same theme object)
            const TestComponent2 = defineComponent({
                template: '<div>test2</div>',
                setup() {
                    usePassThrough(theme)
                }
            })

            mount(TestComponent2)

            // When cache works, processTheme is executed only once
            // Verify WeakMap cache works correctly (performance test)
        })
    })
})
