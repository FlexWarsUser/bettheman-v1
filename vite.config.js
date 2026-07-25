import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // Stop Vite from looking at the server folder
  server: {
    fs: {
      allow: ['.'],
    },
  },
})