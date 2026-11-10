import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one. It never fires, so charts
// keep their initialDimension (tests read the "View as table" fallback, not SVG internals).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
