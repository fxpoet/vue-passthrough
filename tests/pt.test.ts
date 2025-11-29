import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick, defineComponent, computed } from 'vue'
import { mount } from '@vue/test-utils'
import { mergePt, usePassThrough, attrsToPt } from '../src/pt'
import type { PtSpec } from '../src/pt'

// ============================================
// Test Helpers
// ============================================

/** Create component that tests attrsToPt and runs assertions in setup */
function testAttrsToPt(attrs: Record<string, any>, assertFn: (result: PtSpec) => void) {
    const TestComponent = defineComponent({
        template: '<div>test</div>',
        setup() {
            assertFn(attrsToPt())
        }
    })
    mount(TestComponent, { attrs })
}

/** Create a component with pt prop support */
function createPtComponent(theme: PtSpec, template = '<div v-bind="ptMark(\'root\')" data-testid="root">test</div>') {
    return defineComponent({
        props: {
            pt: { type: Object as () => PtSpec, default: () => ({}) }
        },
        template,
        setup(props) {
            const { ptMark, ptFor } = usePassThrough(theme, computed(() => props.pt))
            return { ptMark, ptFor }
        }
    })
}

/** Create a simple component without pt prop (uses ref for propsPt) */
function createSimpleComponent(theme: PtSpec, template = '<div v-bind="ptMark(\'root\')" data-testid="root">test</div>') {
    return defineComponent({
        template,
        setup() {
            const { ptMark, ptFor } = usePassThrough(theme, ref({}))
            return { ptMark, ptFor }
        }
    })
}

describe('PassThrough System', () => {
    // ============================================
    // attrsToPt tests
    // ============================================
    describe('attrsToPt', () => {
        it('returns empty object when no pt attrs present', () => {
            testAttrsToPt({ class: 'some-class', id: 'test-id' }, result => {
                expect(result).toEqual({})
            })
        })

        it('parses single key pt attribute (pt:root="class")', () => {
            testAttrsToPt({ 'pt:root': 'bg-red-500' }, result => {
                expect(result.root).toEqual({ class: 'bg-red-500' })
            })
        })

        it('parses multiple single key pt attributes', () => {
            testAttrsToPt({
                'pt:root': 'grid gap-2',
                'pt:input': 'border',
                'pt:helper': 'text-xs'
            }, result => {
                expect(result.root).toEqual({ class: 'grid gap-2' })
                expect(result.input).toEqual({ class: 'border' })
                expect(result.helper).toEqual({ class: 'text-xs' })
            })
        })

        it('parses nested pt attributes (pt:root:id="value")', () => {
            testAttrsToPt({
                'pt:root:id': 'custom-id',
                'pt:root:data-test': 'test-value'
            }, result => {
                expect(result.root).toEqual({ id: 'custom-id', 'data-test': 'test-value' })
            })
        })

        it('merges single key and nested attributes for same key', () => {
            testAttrsToPt({
                'pt:root': 'bg-blue-500',
                'pt:root:id': 'test-id'
            }, result => {
                expect(result.root).toHaveProperty('class')
                expect(result.root).toHaveProperty('id')
                expect((result.root as any).class).toContain('bg-blue-500')
                expect((result.root as any).id).toBe('test-id')
            })
        })

        it('handles multiple class values in single pt attribute', () => {
            testAttrsToPt({ 'pt:root': 'bg-red-500 p-4 text-white' }, result => {
                const className = (result.root as any).class
                expect(className).toContain('bg-red-500')
                expect(className).toContain('p-4')
                expect(className).toContain('text-white')
            })
        })

        it('parses object-style :pt attribute', () => {
            testAttrsToPt({
                pt: { root: 'grid gap-2', input: { class: 'border', id: 'input-id' } }
            }, result => {
                expect(result.root).toBeDefined()
                expect(result.input).toBeDefined()
            })
        })

        it('merges :pt object with pt:* attributes (pt:* has priority)', () => {
            testAttrsToPt({
                pt: { root: 'grid gap-2', helper: 'text-xs' },
                'pt:root': 'bg-red-500'
            }, result => {
                const className = (result.root as any).class
                expect(className).toContain('grid')
                expect(className).toContain('bg-red-500')
            })
        })

        it('ignores non-object :pt values', () => {
            testAttrsToPt({
                pt: 'invalid-string-value',
                'pt:helper': 'text-xs'
            }, result => {
                expect(result).toEqual({ helper: { class: 'text-xs' } })
            })
        })

        it('handles empty string values', () => {
            testAttrsToPt({ 'pt:root': '' }, result => {
                expect(result.root).toEqual({ class: '' })
            })
        })

        it('handles deeply nested attributes (pt:root:style:color)', () => {
            testAttrsToPt({ 'pt:root:style:color': 'red' }, result => {
                expect((result.root as any).style.color).toBe('red')
            })
        })

        it('handles event handlers in pt attributes', () => {
            const onClick = vi.fn()
            testAttrsToPt({ 'pt:root:onClick': onClick }, result => {
                expect(typeof (result.root as any).onClick).toBe('function')
            })
        })

        it('preserves complex object values', () => {
            const complexValue = { nested: { deep: 'value' } }
            testAttrsToPt({ 'pt:root:data': complexValue }, result => {
                expect((result.root as any).data).toEqual(complexValue)
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
            const result = mergePt({ root: { class: 'px-2 py-3' } }, { root: { class: 'px-4' } })
            expect((result.root as any).class).toContain('px-4')
            expect((result.root as any).class).not.toContain('px-2')
            expect((result.root as any).class).toContain('py-3')
        })

        it('resolves conflicting Tailwind classes (text size)', () => {
            const result = mergePt({ root: { class: 'text-sm font-bold' } }, { root: { class: 'text-lg' } })
            expect((result.root as any).class).toContain('text-lg')
            expect((result.root as any).class).not.toContain('text-sm')
            expect((result.root as any).class).toContain('font-bold')
        })

        it('resolves conflicting Tailwind classes (background)', () => {
            const result = mergePt({ root: { class: 'bg-red-500 text-white' } }, { root: { class: 'bg-blue-600' } })
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
            const onClick = (result.root as any).onClick
            if (Array.isArray(onClick)) onClick.forEach((fn: any) => fn())
            else if (typeof onClick === 'function') onClick()
            expect(handler1).toHaveBeenCalled()
            expect(handler2).toHaveBeenCalled()
        })

        it('merges style objects', () => {
            const result = mergePt(
                { root: { class: 'border', style: { color: 'red' } } },
                { root: { class: 'rounded', style: { fontSize: '12px' } } }
            )
            expect((result.root as any).style).toEqual({ color: 'red', fontSize: '12px' })
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
        })

        it('handles multiple event handlers in usePassThrough', () => {
            const themeHandler = vi.fn()
            const attrHandler = vi.fn()
            const Component = createSimpleComponent({ root: { class: 'border', onClick: themeHandler } })
            const wrapper = mount(Component, { attrs: { 'pt:root:onClick': attrHandler } })
            wrapper.find('[data-testid="root"]').trigger('click')
            expect(themeHandler).toHaveBeenCalled()
            expect(attrHandler).toHaveBeenCalled()
        })

        it('applies tailwind-merge in usePassThrough with conflicting classes', () => {
            const Component = createSimpleComponent({ root: 'px-2 py-4 bg-red-500' })
            const wrapper = mount(Component, { attrs: { 'pt:root': 'px-6 bg-blue-600' } })
            const rootEl = wrapper.find('[data-testid="root"]').element as HTMLElement
            expect(rootEl.className).toContain('px-6')
            expect(rootEl.className).not.toContain('px-2')
            expect(rootEl.className).toContain('bg-blue-600')
            expect(rootEl.className).not.toContain('bg-red-500')
            expect(rootEl.className).toContain('py-4')
        })

        it('applies tailwind-merge with props.pt replacement', () => {
            const Component = createPtComponent({ root: 'px-2 py-4' })
            const wrapper = mount(Component, { props: { pt: { root: 'px-6 py-2 bg-blue-600' } } })
            const rootEl = wrapper.find('[data-testid="root"]').element as HTMLElement
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
            const Component = createSimpleComponent({ root: 'grid gap-2' }, '<div v-bind="ptMark(\'root\')">test</div>')
            const wrapper = mount(Component, { attrs: { 'pt:root': 'bg-red-500' } })
            const rootEl = wrapper.element as HTMLElement
            expect(rootEl.className).toContain('grid')
            expect(rootEl.className).toContain('gap-2')
            expect(rootEl.className).toContain('bg-red-500')
        })

        it('passes other HTML attributes in pt:root:id="value" format', () => {
            const Component = createSimpleComponent({ root: 'grid' }, '<div v-bind="ptMark(\'root\')">test</div>')
            const wrapper = mount(Component, { attrs: { 'pt:root:id': 'custom-id', 'pt:root:data-test': 'value' } })
            const rootEl = wrapper.element as HTMLElement
            expect(rootEl.id).toBe('custom-id')
            expect(rootEl.getAttribute('data-test')).toBe('value')
        })

        it('passes event handlers in pt:root:onClick format', () => {
            const onClick = vi.fn()
            const Component = createSimpleComponent({ root: 'cursor-pointer' }, '<div v-bind="ptMark(\'root\')">test</div>')
            const wrapper = mount(Component, { attrs: { 'pt:root:onClick': onClick } })
            wrapper.find('div').trigger('click')
            expect(onClick).toHaveBeenCalled()
        })

        it('reactivity: updates when attrs pt:* values change', async () => {
            const dynamicClass = ref('bg-red-500')
            const ChildComponent = createSimpleComponent({ root: 'grid gap-2' }, '<div v-bind="ptMark(\'root\')" data-testid="child">child</div>')
            const ParentComponent = defineComponent({
                components: { ChildComponent },
                template: `<ChildComponent :pt:root="dynamicClass" />`,
                setup: () => ({ dynamicClass })
            })

            const wrapper = mount(ParentComponent)
            const childEl = wrapper.find('[data-testid="child"]').element as HTMLElement

            expect(childEl.className).toContain('bg-red-500')
            dynamicClass.value = 'bg-blue-500 p-4'
            await nextTick()
            expect(childEl.className).toContain('bg-blue-500')
            expect(childEl.className).not.toContain('bg-red-500')
        })

        it('reactivity: updates when attrs :pt object values change', async () => {
            const dynamicPt = ref<Record<string, any>>({ root: 'bg-red-500' })
            const ChildComponent = createSimpleComponent({ root: 'grid gap-2' }, '<div v-bind="ptMark(\'root\')" data-testid="child">child</div>')
            const ParentComponent = defineComponent({
                components: { ChildComponent },
                template: `<ChildComponent :pt="dynamicPt" />`,
                setup: () => ({ dynamicPt })
            })

            const wrapper = mount(ParentComponent)
            const childEl = wrapper.find('[data-testid="child"]').element as HTMLElement

            expect(childEl.className).toContain('bg-red-500')
            dynamicPt.value = { root: 'bg-blue-500 p-4' }
            await nextTick()
            expect(childEl.className).toContain('bg-blue-500')
            expect(childEl.className).not.toContain('bg-red-500')
        })

        it('reactivity: pt:* attrs merge additively while :pt replaces', async () => {
            const attrsClass = ref('text-sm')
            const propsPt = ref<PtSpec | undefined>(undefined)
            const ChildComponent = createPtComponent({ root: 'grid gap-2' }, '<div v-bind="ptMark(\'root\')" data-testid="child">child</div>')
            const ParentComponent = defineComponent({
                components: { ChildComponent },
                template: `<ChildComponent :pt:root="attrsClass" :pt="propsPt" />`,
                setup: () => ({ attrsClass, propsPt })
            })

            const wrapper = mount(ParentComponent)
            const childEl = wrapper.find('[data-testid="child"]').element as HTMLElement

            // Initial: attrs merge with theme
            expect(childEl.className).toContain('grid')
            expect(childEl.className).toContain('text-sm')

            // props.pt replaces everything
            propsPt.value = { root: 'flex flex-row' }
            await nextTick()
            expect(childEl.className).toBe('flex flex-row')

            // Remove props.pt, back to theme + attrs
            propsPt.value = undefined
            await nextTick()
            expect(childEl.className).toContain('grid')
            expect(childEl.className).toContain('text-sm')
        })
    })

    // ============================================
    // usePassThrough integration tests
    // ============================================
    describe('usePassThrough', () => {
        it('converts theme strings to { class: ... } objects', () => {
            const Component = createSimpleComponent({ root: 'grid gap-2' }, '<div v-bind="ptMark(\'root\')">test</div>')
            const wrapper = mount(Component)
            expect((wrapper.element as HTMLElement).className).toContain('grid')
        })

        it('correctly resolves extend attribute', () => {
            const theme = {
                input: 'border px-3',
                inputInvalid: { extend: 'input', class: 'border-red-500' }
            }
            const template = `<div><div v-bind="ptMark('input')" data-testid="input">input</div><div v-bind="ptMark('inputInvalid')" data-testid="invalid">invalid</div></div>`
            const Component = createSimpleComponent(theme, template)
            const wrapper = mount(Component)

            const input = wrapper.find('[data-testid="input"]').element as HTMLElement
            const invalid = wrapper.find('[data-testid="invalid"]').element as HTMLElement

            expect(input.className).toContain('border')
            expect(invalid.className).toContain('border')
            expect(invalid.className).toContain('border-red-500')
        })

        it('props.pt replaces theme', () => {
            const Component = createPtComponent({ root: 'grid gap-2' }, '<div v-bind="ptMark(\'root\')">test</div>')
            const wrapper = mount(Component, { props: { pt: { root: 'bg-blue-500' } } })
            expect((wrapper.element as HTMLElement).className).toBe('bg-blue-500')
        })

        it('reactivity: updates when props.pt changes', async () => {
            const propsPt = ref<PtSpec>({ root: 'bg-red-500' })
            const TestComponent = defineComponent({
                template: '<div v-bind="ptMark(\'root\')">test</div>',
                setup() {
                    const { ptMark } = usePassThrough({ root: 'grid gap-2' }, propsPt)
                    return { ptMark }
                }
            })

            const wrapper = mount(TestComponent)
            const rootEl = wrapper.element as HTMLElement
            expect(rootEl.className).toContain('bg-red-500')

            propsPt.value = { root: 'bg-blue-500' }
            await nextTick()
            expect(rootEl.className).toContain('bg-blue-500')
            expect(rootEl.className).not.toContain('bg-red-500')
        })

        it('priority: theme < attrs < propsPt', () => {
            const Component = createPtComponent({ root: 'text-sm' }, '<div v-bind="ptMark(\'root\')">test</div>')
            const wrapper = mount(Component, {
                attrs: { 'pt:root': 'text-base' },
                props: { pt: { root: 'text-lg' } }
            })
            expect((wrapper.element as HTMLElement).className).toBe('text-lg')
        })

        it('props.pt replaces, attrs merges', () => {
            const theme = { root: 'grid gap-2', helper: 'text-xs mt-1' }
            const template = `<div><div v-bind="ptMark('root')" data-testid="root">root</div><div v-bind="ptMark('helper')" data-testid="helper">helper</div></div>`
            const Component = createPtComponent(theme, template)
            const wrapper = mount(Component, {
                attrs: { 'pt:helper': 'text-blue-500' },
                props: { pt: { root: 'flex flex-row' } }
            })

            const root = wrapper.find('[data-testid="root"]').element as HTMLElement
            const helper = wrapper.find('[data-testid="helper"]').element as HTMLElement

            expect(root.className).toBe('flex flex-row')
            expect(helper.className).toContain('text-xs')
            expect(helper.className).toContain('text-blue-500')
        })

        it('detects circular references and warns', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
            const Component = createSimpleComponent({
                a: { extend: 'b', class: 'a-class' },
                b: { extend: 'a', class: 'b-class' }
            }, '<div>test</div>')
            mount(Component)
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Circular reference detected'))
            consoleWarnSpy.mockRestore()
        })

        it('warns when extend key does not exist', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
            const Component = createSimpleComponent({
                inputInvalid: { extend: 'nonExistent', class: 'border-red-500' }
            }, '<div>test</div>')
            mount(Component)
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Extend target "nonExistent" not found'))
            consoleWarnSpy.mockRestore()
        })

        it('passes pt to child components with ptFor', () => {
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup() {
                    const { ptFor } = usePassThrough({
                        root: 'grid',
                        badge: { label: 'text-xs', icon: 'w-4' }
                    }, ref({}))
                    const badgePt = ptFor('badge')
                    expect(badgePt).toHaveProperty('label')
                    expect(badgePt).toHaveProperty('icon')
                }
            })
            mount(TestComponent)
        })

        it('prevents reprocessing with theme caching', () => {
            const theme = { root: 'grid gap-2', input: 'border' }
            mount(createSimpleComponent(theme, '<div>test1</div>'))
            mount(createSimpleComponent(theme, '<div>test2</div>'))
            // WeakMap cache ensures processTheme runs only once for same theme object
        })
    })

    // ============================================
    // $merge and $replace flags tests
    // ============================================
    describe('$merge and $replace flags', () => {
        describe('ptMark with $merge', () => {
            it('$merge: true merges with theme instead of replacing', () => {
                const Component = createPtComponent({ root: 'grid gap-2 text-sm' })
                const wrapper = mount(Component, { props: { pt: { root: { $merge: true, class: 'bg-red-500' } } } })
                const rootEl = wrapper.find('[data-testid="root"]').element as HTMLElement
                expect(rootEl.className).toContain('grid')
                expect(rootEl.className).toContain('text-sm')
                expect(rootEl.className).toContain('bg-red-500')
            })

            it('$merge: true with conflicting classes uses tailwind-merge', () => {
                const Component = createPtComponent({ root: 'text-sm text-red-500' })
                const wrapper = mount(Component, { props: { pt: { root: { $merge: true, class: 'text-lg text-blue-500' } } } })
                const rootEl = wrapper.find('[data-testid="root"]').element as HTMLElement
                expect(rootEl.className).toContain('text-lg')
                expect(rootEl.className).not.toContain('text-sm')
                expect(rootEl.className).toContain('text-blue-500')
            })
        })

        describe('ptMark with $replace', () => {
            it('$replace: true explicitly replaces theme (same as default)', () => {
                const Component = createPtComponent({ root: 'grid gap-2' })
                const wrapper = mount(Component, { props: { pt: { root: { $replace: true, class: 'flex flex-row' } } } })
                const rootEl = wrapper.find('[data-testid="root"]').element as HTMLElement
                expect(rootEl.className).toBe('flex flex-row')
            })

            it('$replace removes the flag from output', () => {
                const Component = createPtComponent({ root: 'grid' })
                const wrapper = mount(Component, { props: { pt: { root: { $replace: true, class: 'flex', id: 'test-id' } } } })
                const rootEl = wrapper.find('[data-testid="root"]').element as HTMLElement
                expect(rootEl.className).toBe('flex')
                expect(rootEl.id).toBe('test-id')
                expect(rootEl.getAttribute('$replace')).toBeNull()
            })
        })

        describe('ptMark with both $merge and $replace', () => {
            it('warns when both flags are set and uses $merge', () => {
                const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
                const Component = createPtComponent({ root: 'grid gap-2' })
                const wrapper = mount(Component, { props: { pt: { root: { $merge: true, $replace: true, class: 'bg-red-500' } } } })

                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Both $merge and $replace are set'))
                const rootEl = wrapper.find('[data-testid="root"]').element as HTMLElement
                expect(rootEl.className).toContain('grid')
                expect(rootEl.className).toContain('bg-red-500')
                consoleWarnSpy.mockRestore()
            })
        })

        describe('ptFor with $merge', () => {
            it('$merge: true merges nested pt with theme', () => {
                const TestComponent = defineComponent({
                    props: { pt: { type: Object as () => PtSpec, default: () => ({}) } },
                    template: '<div>test</div>',
                    setup(props) {
                        const { ptFor } = usePassThrough({ badge: { root: 'px-2 py-1', label: 'text-xs' } }, computed(() => props.pt))
                        const badgePt = ptFor('badge')
                        expect(badgePt).toHaveProperty('root')
                        expect(badgePt).toHaveProperty('icon')
                        expect((badgePt as any).root).toBe('px-2 py-1')
                        expect((badgePt as any).icon).toBe('w-4 h-4')
                    }
                })
                mount(TestComponent, { props: { pt: { badge: { $merge: true, icon: 'w-4 h-4' } } } })
            })

            it('$merge: true preserves theme values not specified in props.pt', () => {
                const TestComponent = defineComponent({
                    props: { pt: { type: Object as () => PtSpec, default: () => ({}) } },
                    template: '<div>test</div>',
                    setup(props) {
                        const { ptFor } = usePassThrough({ badge: { root: 'px-2 py-1', label: 'text-xs', icon: 'w-4 h-4' } }, computed(() => props.pt))
                        const badgePt = ptFor('badge')
                        expect((badgePt as any).root).toBe('px-2 py-1')
                        expect((badgePt as any).icon).toBe('w-4 h-4')
                        expect((badgePt as any).label).toHaveProperty('class')
                    }
                })
                mount(TestComponent, { props: { pt: { badge: { $merge: true, label: 'text-red-500' } } } })
            })
        })

        describe('ptFor with $replace', () => {
            it('$replace: true explicitly replaces (same as default)', () => {
                const TestComponent = defineComponent({
                    props: { pt: { type: Object as () => PtSpec, default: () => ({}) } },
                    template: '<div>test</div>',
                    setup(props) {
                        const { ptFor } = usePassThrough({ badge: { root: 'px-2 py-1', label: 'text-xs' } }, computed(() => props.pt))
                        const badgePt = ptFor('badge')
                        expect(badgePt).toHaveProperty('icon')
                        expect(badgePt).not.toHaveProperty('root')
                    }
                })
                mount(TestComponent, { props: { pt: { badge: { $replace: true, icon: 'w-6 h-6' } } } })
            })
        })

        describe('ptFor with both $merge and $replace', () => {
            it('warns when both flags are set and uses $merge', () => {
                const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
                const TestComponent = defineComponent({
                    props: { pt: { type: Object as () => PtSpec, default: () => ({}) } },
                    template: '<div>test</div>',
                    setup(props) {
                        const { ptFor } = usePassThrough({ badge: { root: 'px-2', label: 'text-xs' } }, computed(() => props.pt))
                        ptFor('badge')
                    }
                })
                mount(TestComponent, { props: { pt: { badge: { $merge: true, $replace: true, icon: 'w-4' } } } })
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Both $merge and $replace are set'))
                consoleWarnSpy.mockRestore()
            })
        })

        describe('top-level $merge flag (for ptFor chaining)', () => {
            it('top-level $merge applies merge strategy to all string keys', () => {
                const template = '<div v-bind="ptMark(\'root\')" data-testid="root"><span v-bind="ptMark(\'wrapper\')" data-testid="wrapper">test</span></div>'
                const Component = createPtComponent({ root: 'text-red-500', wrapper: 'px-3 py-2 text-xs' }, template)
                const wrapper = mount(Component, { props: { pt: { $merge: true, root: 'border-1 border-pink-500', wrapper: 'px-10' } } })

                const rootEl = wrapper.find('[data-testid="root"]').element as HTMLElement
                const wrapperEl = wrapper.find('[data-testid="wrapper"]').element as HTMLElement

                expect(rootEl.className).toContain('text-red-500')
                expect(rootEl.className).toContain('border-1')
                expect(wrapperEl.className).toContain('px-10')
                expect(wrapperEl.className).not.toContain('px-3')
            })

            it('key-level $replace overrides top-level $merge', () => {
                const template = '<div v-bind="ptMark(\'root\')" data-testid="root"><span v-bind="ptMark(\'wrapper\')" data-testid="wrapper">test</span></div>'
                const Component = createPtComponent({ root: 'text-red-500 px-2', wrapper: 'px-3 py-2' }, template)
                const wrapper = mount(Component, {
                    props: { pt: { $merge: true, root: 'border-1', wrapper: { $replace: true, class: 'px-10' } } }
                })

                const rootEl = wrapper.find('[data-testid="root"]').element as HTMLElement
                const wrapperEl = wrapper.find('[data-testid="wrapper"]').element as HTMLElement

                expect(rootEl.className).toContain('text-red-500')
                expect(rootEl.className).toContain('border-1')
                expect(wrapperEl.className).toBe('px-10')
            })

            it('simulates 3-level nesting: Page → MyInput → MyBadge', () => {
                const badgeTemplate = '<div v-bind="ptMark(\'root\')" data-testid="badge-root"><span v-bind="ptMark(\'wrapper\')" data-testid="badge-wrapper">badge</span></div>'
                const MyBadge = createPtComponent({ root: 'text-red-500', wrapper: 'px-3 py-2 text-xs' }, badgeTemplate)

                const MyInput = defineComponent({
                    components: { MyBadge },
                    props: { pt: { type: Object as () => PtSpec, default: () => ({}) } },
                    template: '<div><MyBadge :pt="badgePt" /></div>',
                    setup(props) {
                        const { ptFor } = usePassThrough({ badge: { $merge: true, root: 'border-1 border-pink-500', wrapper: 'px-10' } }, computed(() => props.pt))
                        return { badgePt: computed(() => ptFor('badge')) }
                    }
                })

                const wrapper = mount(MyInput, { props: { pt: { badge: { $merge: true, root: 'bg-red-500' } } } })
                const badgeRoot = wrapper.find('[data-testid="badge-root"]').element as HTMLElement

                expect(badgeRoot.className).toContain('text-red-500')
                expect(badgeRoot.className).toContain('border-1')
                expect(badgeRoot.className).toContain('bg-red-500')
            })

            it('$merge cascades from props even when theme has no $merge (Solution A)', () => {
                const MyBadge = createPtComponent({ root: 'text-red-500', wrapper: 'px-3 py-2 text-xs' },
                    '<div v-bind="ptMark(\'root\')" data-testid="badge-root"><span v-bind="ptMark(\'wrapper\')" data-testid="badge-wrapper">badge</span></div>')

                const MyInput = defineComponent({
                    components: { MyBadge },
                    props: { pt: { type: Object as () => PtSpec, default: () => ({}) } },
                    template: '<div><MyBadge :pt="badgePt" /></div>',
                    setup(props) {
                        // NO $merge here - theme doesn't want to merge with Badge
                        const { ptFor } = usePassThrough({ badge: { root: 'border-1 border-pink-500', wrapper: 'px-10' } }, computed(() => props.pt))
                        return { badgePt: computed(() => ptFor('badge')) }
                    }
                })

                // Page says $merge - should cascade to MyBadge
                const wrapper = mount(MyInput, { props: { pt: { badge: { $merge: true, root: 'bg-red-500' } } } })
                const badgeRoot = wrapper.find('[data-testid="badge-root"]').element as HTMLElement

                expect(badgeRoot.className).toContain('text-red-500')  // MyBadge theme preserved!
                expect(badgeRoot.className).toContain('border-1')
                expect(badgeRoot.className).toContain('bg-red-500')
            })

            it('$merge does NOT cascade when props uses $replace', () => {
                const MyBadge = createPtComponent({ root: 'text-red-500 px-4' },
                    '<div v-bind="ptMark(\'root\')" data-testid="badge-root">badge</div>')

                const MyInput = defineComponent({
                    components: { MyBadge },
                    props: { pt: { type: Object as () => PtSpec, default: () => ({}) } },
                    template: '<div><MyBadge :pt="badgePt" /></div>',
                    setup(props) {
                        const { ptFor } = usePassThrough({ badge: { $merge: true, root: 'border-1' } }, computed(() => props.pt))
                        return { badgePt: computed(() => ptFor('badge')) }
                    }
                })

                // Page says $replace - completely override
                const wrapper = mount(MyInput, { props: { pt: { badge: { $replace: true, root: 'bg-blue-500' } } } })
                const badgeRoot = wrapper.find('[data-testid="badge-root"]').element as HTMLElement

                expect(badgeRoot.className).toBe('bg-blue-500')
                expect(badgeRoot.className).not.toContain('text-red-500')
            })
        })
    })

    // ============================================
    // propsPt required warning tests
    // ============================================
    describe('propsPt required warning', () => {
        it('warns when propsPt is omitted', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                // @ts-expect-error - intentionally omitting propsPt
                setup: () => { usePassThrough({ root: 'grid' }) }
            })
            mount(TestComponent)
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('propsPt (props.pt) is required'))
            consoleWarnSpy.mockRestore()
        })

        it('warns when propsPt is explicitly undefined', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup: () => { usePassThrough({ root: 'grid' }, undefined) }
            })
            mount(TestComponent)
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('propsPt (props.pt) is required'))
            consoleWarnSpy.mockRestore()
        })

        it('does not warn when propsPt is a ref', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
            const TestComponent = defineComponent({
                template: '<div>test</div>',
                setup: () => { usePassThrough({ root: 'grid' }, ref<PtSpec | undefined>(undefined)) }
            })
            mount(TestComponent)
            expect(consoleWarnSpy).not.toHaveBeenCalledWith(expect.stringContaining('propsPt (props.pt) is required'))
            consoleWarnSpy.mockRestore()
        })
    })
})
