import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/discovery/express.ts',
    'src/discovery/fastify.ts'
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: true,
  outDir: 'dist',
  target: 'node18'
});
