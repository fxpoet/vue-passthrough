<template>
    <span v-bind="ptMark('root')">
        <div class="label-wrapper" v-bind="ptMark('wrapper')">
            <slot>{{ label }}</slot>
        </div>
    </span>
</template>

<script setup lang="ts">
import { usePassThrough, type PtSpec, defineTheme } from 'vue-passthrough'

interface Props {
    label?: string
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning'
    pt?: PtSpec
}

const props = withDefaults(defineProps<Props>(), {
    variant: 'primary'
})

const variantClasses: Record<string, string> = {
    primary: 'bg-blue-100 text-blue-800',
    secondary: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    danger: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800'
}

const theme = defineTheme({
    root: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[props.variant]}`,
    wrapper: 'px-3 py-2 text-xs'
})
const { ptMark } = usePassThrough(theme, props.pt)
</script>
