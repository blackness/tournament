import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // UI utilities
          'vendor-ui': ['lucide-react', 'zustand'],
          // Heavy/rarely used libraries
          'vendor-pdf': ['@react-pdf/renderer'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-csv': ['papaparse'],
        }
      }
    },
    // Increase chunk size warning limit slightly
    chunkSizeWarningLimit: 600,
  }
})
