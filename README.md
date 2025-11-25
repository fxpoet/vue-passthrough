# Vue PassThrough

A Vue composable for styling nested elements inside Vue components from parent level

A Vue composable that allows you to inject styles and attributes directly into any nested element within a component, no matter how deep. Makes your components highly reusable and customizable with Tailwind CSS support.

> Inspired by [PrimeVue's PassThrough API](https://primevue.org/passthrough/) - See [what's different](#whats-different-from-primevues-passthrough)

> **For LLMs/AI Tools:** See [LLM.txt](https://raw.githubusercontent.com/fxpoet/vue-passthrough/refs/heads/master/LLM.txt) for a concise API reference optimized for AI assistance.

## Features

- **Flexible Style Customization**: Inject classes and HTML attributes into any component element from the outside
- **Tailwind CSS Optimized**: Automatic class conflict resolution using `tailwind-merge`
- **Full Reactivity**: Seamlessly integrated with Vue's reactivity system (supports ref/computed)
- **TypeScript Support**: Full type safety with generic `usePassThrough<T>`, `defineTheme`, and autocomplete
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
  <div v-bind="ptPoint('root')">
    <input v-bind="ptPoint('input')" />
    <div v-bind="ptPoint('helper')">
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

const { ptPoint } = usePassThrough(theme, props.pt)
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
const { ptPoint } = usePassThrough({
  input: 'w-full rounded-xl border px-3 py-2',
  inputInvalid: { // Inherit from input and add additional styles
    extend: 'input',
    class: 'border-red-500 focus:ring-red-500'
  }
})
</script>

<template>
  <input v-bind="ptPoint(props.invalid ? 'inputInvalid' : 'input')" />
</template>
```

### Passing pt to Child Components (ptFor)

Pass pt specifications to nested components.

```vue
<script setup lang="ts">
const { ptPoint, ptFor } = usePassThrough({
  root: 'flex items-center gap-2',
  badge: { // badge is a nested object (no class property)
    root: 'px-2 py-1 rounded',
    label: 'text-xs font-bold',
    icon: 'w-4 h-4'
  }
})
</script>

<template>
  <div v-bind="ptPoint('root')">
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
  <div v-bind="ptPoint('root')">
    <label v-bind="ptPoint('label')">
      {{ label }}
    </label>

    <input
      v-model="modelValue"
      :placeholder="placeholder"
      v-bind="ptPoint(error ? 'inputError' : 'input')"
    />

    <p v-if="error" v-bind="ptPoint('errorMessage')">
      {{ error }}
    </p>

    <div v-bind="ptPoint('helper')">
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

const { ptPoint } = usePassThrough({
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
  <button v-bind="ptPoint('root')">
    <Icon v-if="icon" :name="icon" v-bind="ptPoint('icon')" />

    <span v-bind="ptPoint('label')">
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

const { ptPoint, ptFor } = usePassThrough({
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

## What's Different from PrimeVue's PassThrough?

While inspired by PrimeVue, this library offers key improvements for building custom components:

- **Per-Key Replace (not Whole Object)**: In PrimeVue, `:pt="{ root: '...' }"` replaces the **entire** pt object. In vue-passthrough, only the specified keys are replaced - other keys keep their theme defaults.
  ```vue
  <!-- theme: { root: 'grid', input: 'border', helper: 'text-xs' } -->

  <!-- PrimeVue: root, input, helper ALL gone -->
  <InputSwitch :pt="{ root: 'flex' }" />

  <!-- vue-passthrough: only root replaced, input & helper keep theme -->
  <MyInput :pt="{ root: 'flex' }" />
  <!-- → root: 'flex', input: 'border', helper: 'text-xs' -->
  ```
- **Built-in Tailwind Support**: Automatic class conflict resolution with `tailwind-merge` - no manual handling needed.
- **Event Handler Chaining**: Uses Vue's `mergeProps` to chain event handlers instead of replacing them.
- **Extend Pattern**: Built-in style inheritance to reuse common patterns (e.g., `inputError` extends `input`).

## API Reference

### usePassThrough<T>(theme, propsPt?)

Main composable function for the PassThrough system with full TypeScript support.

**Parameters:**

- `theme: T extends PtSpec` - Default theme definition (use with `defineTheme` for best type inference)
- `propsPt?: MaybeRef<PtSpec | undefined>` - props.pt (optional, automatically handles ref/computed)

**Returns:**

```typescript
{
  ptPoint: (key: ThemeKeys<T>) => Record<string, any>,  // Type-safe keys with autocomplete
  ptFor: (key: ThemeKeys<T>) => PtSpec,                 // Type-safe keys with autocomplete
  debugPt: ComputedRef<PtSpec>
}
```

**Basic Usage (without types):**

```vue
<script setup lang="ts">
import { usePassThrough } from 'vue-passthrough'

const { ptPoint } = usePassThrough({
  root: 'grid gap-2',
  input: 'border px-3'
}, props.pt)
</script>
```

**Type-Safe Usage (with defineTheme):**

```vue
<script setup lang="ts">
import { usePassThrough, defineTheme, PtSpec } from 'vue-passthrough'

// defineTheme preserves type information for autocomplete
const theme = defineTheme({
  root: 'grid gap-2',
  input: 'border px-3',
  helper: 'text-xs'
})

const props = defineProps<{ pt?: PtSpec }>()

// TypeScript infers theme keys automatically
const { ptPoint } = usePassThrough(theme, props.pt)
</script>

<template>
  <div v-bind="ptPoint('root')">
    <input v-bind="ptPoint('input')" />
    <!-- ptPoint('root'), ptPoint('input'), ptPoint('helper') have autocomplete ✅ -->
    <!-- ptPoint('invalid') will show TypeScript error ❌ -->
  </div>
</template>
```

### defineTheme(theme)

Helper function to define a strongly-typed theme with preserved type information for better autocomplete and type checking.

**Parameters:**

- `theme: T extends PtSpec` - Theme configuration object

**Returns:** The same theme object with preserved type information

**Example:**

```typescript
const myTheme = defineTheme({
  root: 'grid gap-2',
  input: 'border px-3',
  inputError: {
    extend: 'input',
    class: 'border-red-500'
  },
  badge: {
    root: 'px-2 py-1 rounded',
    label: 'text-xs font-medium'
  }
})

const { ptPoint, ptFor } = usePassThrough(myTheme, props.pt)
// Now you get autocomplete for all theme keys!
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

### ThemeKeys<T> Type

Type helper to extract theme keys for type-safe operations.

```typescript
const theme = defineTheme({
  root: 'grid',
  input: 'border',
  helper: 'text-xs'
})

type MyThemeKeys = ThemeKeys<typeof theme> // 'root' | 'input' | 'helper'

function customFunction(key: MyThemeKeys) {
  // key is now type-safe
}
```

## Requirements
- Vue 3.2+


## Github Repository
https://github.com/fxpoet/vue-passthrough


## License
MIT
