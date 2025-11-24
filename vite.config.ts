import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
    plugins: [vue()],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'VuePassthrough',
            formats: ['es', 'cjs'],
            fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`
        },
        rollupOptions: {
            external: ['vue', 'tailwind-merge'],
            output: {
                globals: {
                    vue: 'Vue',
                    'tailwind-merge': 'tailwindMerge'
                },
                exports: 'named'
            }
        },
        sourcemap: true,
        emptyOutDir: true
    }
})
