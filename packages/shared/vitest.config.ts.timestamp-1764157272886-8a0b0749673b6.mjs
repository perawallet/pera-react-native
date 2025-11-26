// vitest.config.ts
import { defineConfig } from "file:///Users/williambeaumont/Projects/Source/Pera/pera-rn/node_modules/.pnpm/vitest@2.1.9_@types+node@24.10.0_happy-dom@19.0.2_jsdom@27.1.0_lightningcss@1.30.1_msw@_3a9e421be68640d3b89df5eaec1971ed/node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
var __vite_injected_original_import_meta_url = "file:///Users/williambeaumont/Projects/Source/Pera/pera-rn/packages/shared/vitest.config.ts";
var __filename = fileURLToPath(__vite_injected_original_import_meta_url);
var __dirname = dirname(__filename);
var vitest_config_default = defineConfig({
  resolve: {
    alias: {
      "@services": resolve(__dirname, "src/services"),
      "@store": resolve(__dirname, "src/store"),
      "@api": resolve(__dirname, "src/api"),
      "@platform": resolve(__dirname, "src/platform"),
      "@test-utils": resolve(__dirname, "src/test-utils"),
      config: resolve(__dirname, "src/config")
    }
  },
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    environment: "jsdom",
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/api/generated/**",
        "src/**/*.d.ts",
        "src/**/__tests__/**",
        "src/**/__mocks__/**",
        "src/**/__fixtures__/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/index.ts",
        "src/test-utils/**"
      ],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    }
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy93aWxsaWFtYmVhdW1vbnQvUHJvamVjdHMvU291cmNlL1BlcmEvcGVyYS1ybi9wYWNrYWdlcy9zaGFyZWRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy93aWxsaWFtYmVhdW1vbnQvUHJvamVjdHMvU291cmNlL1BlcmEvcGVyYS1ybi9wYWNrYWdlcy9zaGFyZWQvdml0ZXN0LmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvd2lsbGlhbWJlYXVtb250L1Byb2plY3RzL1NvdXJjZS9QZXJhL3BlcmEtcm4vcGFja2FnZXMvc2hhcmVkL3ZpdGVzdC5jb25maWcudHNcIjsvKlxuIENvcHlyaWdodCAyMDIyLTIwMjUgUGVyYSBXYWxsZXQsIExEQVxuIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4geW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdCBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZVxuICovXG5cbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGVzdC9jb25maWcnXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAnbm9kZTp1cmwnXG5pbXBvcnQgeyBkaXJuYW1lLCByZXNvbHZlIH0gZnJvbSAnbm9kZTpwYXRoJ1xuXG5jb25zdCBfX2ZpbGVuYW1lID0gZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpXG5jb25zdCBfX2Rpcm5hbWUgPSBkaXJuYW1lKF9fZmlsZW5hbWUpXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gICAgcmVzb2x2ZToge1xuICAgICAgICBhbGlhczoge1xuICAgICAgICAgICAgJ0BzZXJ2aWNlcyc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL3NlcnZpY2VzJyksXG4gICAgICAgICAgICAnQHN0b3JlJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvc3RvcmUnKSxcbiAgICAgICAgICAgICdAYXBpJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvYXBpJyksXG4gICAgICAgICAgICAnQHBsYXRmb3JtJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvcGxhdGZvcm0nKSxcbiAgICAgICAgICAgICdAdGVzdC11dGlscyc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL3Rlc3QtdXRpbHMnKSxcbiAgICAgICAgICAgIGNvbmZpZzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvY29uZmlnJyksXG4gICAgICAgIH0sXG4gICAgfSxcbiAgICB0ZXN0OiB7XG4gICAgICAgIGdsb2JhbHM6IHRydWUsXG4gICAgICAgIHNldHVwRmlsZXM6IFsnLi92aXRlc3Quc2V0dXAudHMnXSxcbiAgICAgICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXG4gICAgICAgIGNvdmVyYWdlOiB7XG4gICAgICAgICAgICBwcm92aWRlcjogJ3Y4JyxcbiAgICAgICAgICAgIGFsbDogdHJ1ZSxcbiAgICAgICAgICAgIGluY2x1ZGU6IFsnc3JjLyoqLyoue3RzLHRzeH0nXSxcbiAgICAgICAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgICAgICAgICAnc3JjL2FwaS9nZW5lcmF0ZWQvKionLFxuICAgICAgICAgICAgICAgICdzcmMvKiovKi5kLnRzJyxcbiAgICAgICAgICAgICAgICAnc3JjLyoqL19fdGVzdHNfXy8qKicsXG4gICAgICAgICAgICAgICAgJ3NyYy8qKi9fX21vY2tzX18vKionLFxuICAgICAgICAgICAgICAgICdzcmMvKiovX19maXh0dXJlc19fLyoqJyxcbiAgICAgICAgICAgICAgICAnc3JjLyoqLyoudGVzdC57dHMsdHN4fScsXG4gICAgICAgICAgICAgICAgJ3NyYy8qKi8qLnNwZWMue3RzLHRzeH0nLFxuICAgICAgICAgICAgICAgICdzcmMvKiovaW5kZXgudHMnLFxuICAgICAgICAgICAgICAgICdzcmMvdGVzdC11dGlscy8qKicsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVwb3J0ZXI6IFsndGV4dCcsICdodG1sJywgJ2xjb3YnXSxcbiAgICAgICAgICAgIHJlcG9ydHNEaXJlY3Rvcnk6ICcuL2NvdmVyYWdlJyxcbiAgICAgICAgICAgIHRocmVzaG9sZHM6IHtcbiAgICAgICAgICAgICAgICBnbG9iYWw6IHtcbiAgICAgICAgICAgICAgICAgICAgYnJhbmNoZXM6IDkwLFxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbnM6IDkwLFxuICAgICAgICAgICAgICAgICAgICBsaW5lczogOTAsXG4gICAgICAgICAgICAgICAgICAgIHN0YXRlbWVudHM6IDkwLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgIH0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQVlBLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsU0FBUyxlQUFlO0FBZCtNLElBQU0sMkNBQTJDO0FBZ0JqUyxJQUFNLGFBQWEsY0FBYyx3Q0FBZTtBQUNoRCxJQUFNLFlBQVksUUFBUSxVQUFVO0FBRXBDLElBQU8sd0JBQVEsYUFBYTtBQUFBLEVBQ3hCLFNBQVM7QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNILGFBQWEsUUFBUSxXQUFXLGNBQWM7QUFBQSxNQUM5QyxVQUFVLFFBQVEsV0FBVyxXQUFXO0FBQUEsTUFDeEMsUUFBUSxRQUFRLFdBQVcsU0FBUztBQUFBLE1BQ3BDLGFBQWEsUUFBUSxXQUFXLGNBQWM7QUFBQSxNQUM5QyxlQUFlLFFBQVEsV0FBVyxnQkFBZ0I7QUFBQSxNQUNsRCxRQUFRLFFBQVEsV0FBVyxZQUFZO0FBQUEsSUFDM0M7QUFBQSxFQUNKO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDRixTQUFTO0FBQUEsSUFDVCxZQUFZLENBQUMsbUJBQW1CO0FBQUEsSUFDaEMsYUFBYTtBQUFBLElBQ2IsVUFBVTtBQUFBLE1BQ04sVUFBVTtBQUFBLE1BQ1YsS0FBSztBQUFBLE1BQ0wsU0FBUyxDQUFDLG1CQUFtQjtBQUFBLE1BQzdCLFNBQVM7QUFBQSxRQUNMO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNKO0FBQUEsTUFDQSxVQUFVLENBQUMsUUFBUSxRQUFRLE1BQU07QUFBQSxNQUNqQyxrQkFBa0I7QUFBQSxNQUNsQixZQUFZO0FBQUEsUUFDUixRQUFRO0FBQUEsVUFDSixVQUFVO0FBQUEsVUFDVixXQUFXO0FBQUEsVUFDWCxPQUFPO0FBQUEsVUFDUCxZQUFZO0FBQUEsUUFDaEI7QUFBQSxNQUNKO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
