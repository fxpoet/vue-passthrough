<template>
<div v-bind="ptMark('root')">
    <label v-if="label" v-bind="ptMark('label')">
        {{ label }}
    </label>
    <input v-bind="ptMark('input')" :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
    <p v-if="helper" v-bind="ptMark('helper')">
        {{ helper }}
        <Badge label="tag" :pt="ptFor('badge')" />
    </p>
</div>
</template>

<script setup lang="ts">
import { usePassThrough, type PtSpec } from 'vue-passthrough'
import Badge from './MyBadge.vue'

interface Props {
    label?: string
    helper?: string
    modelValue?: string
    pt?: PtSpec
    invalid?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    invalid: false
})

defineEmits<{
    'update:modelValue': [value: string]
}>()

const { ptMark, ptFor } = usePassThrough({
    root: 'flex flex-col gap-2',
    label: 'text-sm font-medium text-gray-700',
    input: {
        class: 'px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
    },
    inputInvalid: {
        extend: 'input',
        class: 'border-red-500 focus:ring-red-500'
    },
    helper: 'text-xs text-gray-500',
    badge: {
        $merge: true,
        root: 'border-1 border-pink-500',
        wrapper: 'px-10'
    }
}, props.pt)
</script>
