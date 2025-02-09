// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // You can reference your environment variables here,
    // but note that Vite exposes them via import.meta.env in your code.
    'process.env': {} // For compatibility, though not recommended.
  }
});
