<template>
<div class="min-h-screen bg-gray-50 py-12 px-4">
    <div class="max-w-4xl mx-auto space-y-8">
        <header class="text-center">
            <h1 class="text-4xl font-bold text-gray-900 mb-2">
                Vue PassThrough Playground
            </h1>
        </header>

        <div class="space-y-6">
            <section class="bg-white rounded-lg shadow p-6">
                <h2 class="text-2xl font-semibold mb-4">Example: Props PT</h2>
                <ExamplePropsPt />
            </section>
        </div>
    </div>
</div>
</template>

<script setup lang="ts">
import ExamplePropsPt from './examples/ExamplePropsPt.vue'
</script>
