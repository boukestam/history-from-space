import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  server: {
    host: true
  },
  plugins: [preact({
    include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.glsl', 'src/**/*.txt'],
  })],
})
