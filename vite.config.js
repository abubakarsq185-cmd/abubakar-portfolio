import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Two build modes:
//  - default          → optimised multi-chunk static site for hosting (/dist)
//  - SINGLEFILE=1      → one fully inlined index.html (used for the shareable
//                        self-contained preview); three/gsap are folded in.
const singleFile = process.env.SINGLEFILE === '1'

export default defineConfig({
  server: {
    open: true,
    port: 5173,
    host: true,
  },
  plugins: singleFile ? [viteSingleFile()] : [],
  build: {
    target: 'es2020',
    cssCodeSplit: !singleFile,
    assetsInlineLimit: 4096,
    reportCompressedSize: false,
    rollupOptions: singleFile
      ? {}
      : {
          output: {
            // three is only pulled in if the optional 3D scene is re-enabled;
            // Rollup will create the chunk automatically when it is imported.
            manualChunks: {
              gsap: ['gsap'],
            },
          },
        },
  },
})
