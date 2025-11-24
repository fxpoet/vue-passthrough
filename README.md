# Vue PassThrough

A Vue composable for styling nested elements inside Vue components from parent level

A Vue composable that allows you to inject styles and attributes directly into any nested element within a component, no matter how deep. Makes your components highly reusable and customizable with Tailwind CSS support.

> Inspired by [PrimeVue's PassThrough API](https://primevue.org/passthrough/)

## Features

- **Flexible Style Customization**: Inject classes and HTML attributes into any component element from the outside
- **Tailwind CSS Optimized**: Automatic class conflict resolution using `tailwind-merge`
- **Full Reactivity**: Seamlessly integrated with Vue's reactivity system
- **Extend Pattern**: Style inheritance to reduce duplication
- **3-Tier Merging**: Automatic merging with priority: props.pt > attrs > theme

## Installation

```bash
npm install vue-passthrough
```

## Basic Usage

### 1. In Your Component

```vue
<template>
  <div v-bind="pt('root')">
    <input v-bind="pt('input')" />
    <div v-bind="pt('helper')">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePassThrough, PtSpec } from 'vue-passthrough'

const props = defineProps<{
  pt?: PtSpec
}>()

// Define default theme
let theme = {
  root: 'grid gap-1.5',
  input: 'w-full rounded-xl border px-3 py-2',
  helper: 'text-xs text-gray-500'
}

const { pt } = usePassThrough(theme, props.pt)
</script>
```

### 2. Using the Component

#### Method 1: Via pt prop

```vue
<MyInput :pt="{ root: 'bg-white p-4', input: 'border-blue-500' }" />
```

#### Method 2: Via attrs (shorthand)

```vue
<MyInput pt:root="bg-white p-4" pt:input="border-blue-500" />
```

#### Method 3: Nested attributes

```vue
<MyInput
  pt:input:id="my-input"
  pt:input:data-test="value"
  pt:input:onClick="handleClick"
/>
```

## Advanced Features

### Extend Pattern (Style Inheritance)

Reuse styles by inheriting from existing definitions.

```vue
<script setup lang="ts">
const { pt } = usePassThrough({
  input: 'w-full rounded-xl border px-3 py-2',
  inputInvalid: { // Inherit from input and add additional styles
    extend: 'input',
    class: 'border-red-500 focus:ring-red-500'
  }
})
</script>

<template>
  <input v-bind="pt(props.invalid ? 'inputInvalid' : 'input')" />
</template>
```

### Passing pt to Child Components (ptFor)

Pass pt specifications to nested components.

```vue
<script setup lang="ts">
const { pt, ptFor } = usePassThrough({
  root: 'flex items-center gap-2',
  badge: { // badge is a nested object (no class property)
    root: 'px-2 py-1 rounded',
    label: 'text-xs font-bold',
    icon: 'w-4 h-4'
  }
})
</script>

<template>
  <div v-bind="pt('root')">
    <!-- Pass badge pt to child component -->
    <Badge :pt="ptFor('badge')" />
  </div>
</template>
```

Usage:

```vue
<MyButton :pt="{ badge: { label: 'text-red-500', icon: 'w-6 h-6' } }" />
```

## Merge Strategy: Replace vs Merge

The PassThrough system **automatically** chooses replace/merge based on how you pass the pt.

### Core Principle

```vue
<!-- attrs (pt:*) = MERGE strategy -->
<MyInput pt:root="bg-blue-500" />
→ Merges with theme: 'grid gap-1.5 bg-blue-500'

<!-- props (:pt) = REPLACE strategy -->
<MyInput :pt="{ root: 'flex flex-row' }" />
→ Ignores theme: applies 'flex flex-row' only
```

### Why This Design?

| Method | Intent | Use Case |
|--------|--------|----------|
| `pt:root="..."` | "Slight adjustment" | Change color, add spacing, etc. |
| `:pt="{ root: '...' }"` | "Complete override" | Change layout, completely different design |

- **attrs feels like "adding attributes"** → append to existing
- **props object feels like "configuration replacement"** → redefine completely

### Real-World Examples

#### Example 1: Simple Adjustment (attrs = merge)

```vue
<!-- theme: { root: 'grid gap-1.5', input: 'border px-3' } -->

<MyInput
  pt:root="p-4"              <!-- theme + addition -->
  pt:input="border-blue-500" <!-- theme + addition -->
/>

<!-- Result -->
<!-- root: 'grid gap-1.5 p-4' -->
<!-- input: 'border px-3 border-blue-500' -->
```

#### Example 2: Completely Different Design (props = replace)

```vue
<!-- theme: { root: 'grid gap-1.5', input: 'border px-3' } -->

<MyInput
  :pt="{
    root: 'flex flex-row items-center gap-4',  <!-- ignore theme -->
    input: 'rounded-full bg-gray-100 px-6'     <!-- ignore theme -->
  }"
/>

<!-- Result -->
<!-- root: 'flex flex-row items-center gap-4' (complete theme replacement) -->
<!-- input: 'rounded-full bg-gray-100 px-6' (complete theme replacement) -->
```

#### Example 3: Mixed Usage (different strategy per key)

```vue
<!-- theme: { root: 'grid gap-1.5', helper: 'text-xs text-gray-500', input: 'border' } -->

<MyInput
  pt:helper="text-blue-500"           <!-- helper: merge -->
  :pt="{
    root: 'flex flex-row',             <!-- root: replace -->
    input: 'rounded-full'               <!-- input: replace -->
  }"
/>

<!-- Result -->
<!-- root: 'flex flex-row' (ignore theme) -->
<!-- input: 'rounded-full' (ignore theme) -->
<!-- helper: 'text-xs text-gray-500 text-blue-500' (theme + attrs) -->
```

#### Example 4: Dark Mode Toggle

```vue
<script setup lang="ts">
const isDarkPartial = ref(false)

const darkPt = computed(() => isDarkPartial ? {
  root: 'bg-gray-900 text-white',
  input: 'bg-gray-800 border-gray-700 text-white'
} : {})
</script>

<template>
  <!-- Completely replace theme when dark mode -->
  <MyInput :pt="darkPt" />
</template>
```

### Priority Summary

```
If key exists in props.pt → REPLACE (ignore theme)
If key doesn't exist in props.pt → MERGE theme + attrs
```

## Practical Examples

### Example 1: Input Component

```vue
<template>
  <div v-bind="pt('root')">
    <label v-bind="pt('label')">
      {{ label }}
    </label>

    <input
      v-model="modelValue"
      :placeholder="placeholder"
      v-bind="pt(error ? 'inputError' : 'input')"
    />

    <p v-if="error" v-bind="pt('errorMessage')">
      {{ error }}
    </p>

    <div v-bind="pt('helper')">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePassThrough } from 'vue-passthrough'
import type { PtSpec } from 'vue-passthrough'

const props = defineProps<{
  modelValue?: string
  label?: string
  placeholder?: string
  error?: string
  pt?: PtSpec
}>()

const { pt } = usePassThrough({
  root: 'grid gap-2',
  label: 'text-sm font-medium text-gray-700',
  input: 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
  inputError: {
    extend: 'input',
    class: 'border-red-500 focus:ring-red-500'
  },
  errorMessage: 'text-xs text-red-500 mt-1',
  helper: 'text-xs text-gray-500'
}, props.pt)
</script>
```

Usage:

```vue
<Input
  v-model="email"
  label="Email"
  placeholder="Enter your email"
  :error="emailError"
  :pt="{
    root: 'mb-4',
    input: 'text-base',
    label: 'text-blue-600'
  }"
>
  Optional field
</Input>
```

### Example 2: Button Component (with nested components)

```vue
<template>
  <button v-bind="pt('root')">
    <Icon v-if="icon" :name="icon" v-bind="pt('icon')" />

    <span v-bind="pt('label')">
      <slot />
    </span>

    <Badge v-if="badge" :pt="ptFor('badge')">
      {{ badge }}
    </Badge>
  </button>
</template>

<script setup lang="ts">
import { usePassThrough } from 'vue-passthrough'
import type { PtSpec } from 'vue-passthrough'

const props = defineProps<{
  icon?: string
  badge?: string
  variant?: 'primary' | 'secondary'
  pt?: PtSpec
}>()

const { pt, ptFor } = usePassThrough({
  root: props.variant === 'primary'
    ? 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600'
    : 'px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300',
  icon: 'w-5 h-5',
  label: 'font-medium',

  // pt for nested component
  badge: {
    root: 'ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full',
    label: 'font-bold'
  }
}, props.pt)
</script>
```

Usage:

```vue
<Button
  variant="primary"
  icon="plus"
  badge="3"
  :pt="{
    root: 'w-full',
    icon: 'w-6 h-6',
    badge: {
      root: 'bg-yellow-500',
      label: 'text-black'
    }
  }"
>
  New Message
</Button>
```

## API Reference

### usePassThrough(theme, propsPt?)

Main composable function for the PassThrough system.

**Parameters:**

- `theme: PtSpec` - Default theme definition (required)
- `propsPt?: MaybeRef<PtSpec>` - props.pt (optional, automatically handles ref/computed)

**Returns:**

```typescript
{
  pt: (key: string) => Record<string, any>,
  ptFor: (componentKey: string) => PtSpec,
  debugPt: ComputedRef<PtSpec>
}
```

### PtSpec Type

```typescript
interface PtSpec {
  [key: string]:
    | string                    // class shorthand
    | Record<string, any>        // HTML attributes object
    | PtSpec                     // nested pt (for child components)
    | undefined
}
```

## Reactivity

All pt sources support full reactivity.

```vue
<script setup lang="ts">
import { ref } from 'vue'

const customPt = ref({ root: 'bg-red-500' })

const { pt } = usePassThrough({
  root: 'grid'
}, customPt)

// Reactive update
setTimeout(() => {
  customPt.value = { root: 'bg-blue-500' }  // UI updates automatically
}, 1000)
</script>
```

## Requirements
- Vue 3.2+


## Github Repository
https://github.com/fxpoet/vue-passthrough


## License
MIT
