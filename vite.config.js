import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoName = 'PR_Nexus_FishMart'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isGitHubPages = mode === 'gh-pages' || process.env.DEPLOY_ENV === 'GH_PAGES'

  return {
    base: isGitHubPages ? `/${repoName}/` : '/',
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      open: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      cssMinify: true,
      chunkSizeWarningLimit: 1000,
    },
  }
})

