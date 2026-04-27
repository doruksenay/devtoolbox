import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// base is set to '/devtoolbox/' for GitHub Pages deployment
// Change to '/' if deploying to a root domain
export default defineConfig({
  plugins: [react()],
  base: '/devtoolbox/',
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
