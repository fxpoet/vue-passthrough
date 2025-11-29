<template>
  <div class="space-y-4">
    <p class="text-gray-600 mb-4">
      Use :pt prop to customize the component style.
    </p>

    <MyInput
      label="Custom Style Input"
      helper="Changed the style with the :pt prop"
      v-model="value"
      :pt="{
        root: 'flex flex-col gap-3',
        label: 'text-base font-bold text-purple-700',
        input: 'px-4 py-3 border-2 border-purple-500 rounded-lg focus:ring-purple-500 bg-purple-50',
        helper: 'text-sm text-purple-600 font-medium',
        badge: {
          $merge: true,
          wrapper: 'text-lg text-red-500'
        }
      }"
    />

    <details class="mt-4">
      <summary class="cursor-pointer text-sm text-blue-600 hover:text-blue-700">
        View Code
      </summary>
      <pre class="mt-2 p-4 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto"><code>&lt;MyInput
  label="Custom Style Input"
  helper="Changed the style with the :pt prop"
  v-model="value"
  :pt="{
    root: 'flex flex-col gap-3',
    label: 'text-base font-bold text-purple-700',
    input: 'px-4 py-3 border-2 border-purple-500 rounded-lg focus:ring-purple-500 bg-purple-50',
    helper: 'text-sm text-purple-600 font-medium'
  }"
/&gt;</code></pre>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MyInput from '../components/MyInput.vue'

const value = ref('')
</script>
