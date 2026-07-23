import { defineConfig } from 'vite'

// Cinematic single-page restaurant build.
// - manualChunks isolates the heavy 3D libraries so first paint stays light.
// - assetsInlineLimit keeps small SVG placeholders inline to cut requests.
export default defineConfig({
  server: {
    open: true,
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap'],
        },
      },
    },
  },
})
