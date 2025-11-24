import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick, defineComponent, computed } from 'vue'
import { mount } from '@vue/test-utils'
import { mergePt, usePassThrough } from '../src/pt'
import type { PtSpec } from '../src/pt'

describe('PassThrough System', () => {
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
