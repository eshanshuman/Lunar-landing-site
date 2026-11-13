import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative base so the same build works on Vercel and on a GitHub Pages sub-path.
  base: './',
  plugins: [react(), tailwindcss()],
  test: { include: ['src/**/*.test.ts'] },
})
