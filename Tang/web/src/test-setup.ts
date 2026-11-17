import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one. It never fires, so charts
// keep their initialDimension (tests read the "View as table" fallback, not SVG internals).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Any console.error during a test (React key/act/prop warnings, uncaught render errors) fails that test,
// so warnings the browser console would show can't slip through a green run.
let consoleErrors: unknown[][] = []
// React passes printf-style args ("An update to %s ..."): fill them in so the failure names the component.
const format = (...args: unknown[]) => {
  const [first = '', ...rest] = args.map(String)
  return first.replace(/%[sdoO]/g, () => rest.shift() ?? '') + (rest.length ? ` ${rest.join(' ')}` : '')
}
const realConsoleError = console.error
beforeEach(() => {
  consoleErrors = []
  console.error = (...args: unknown[]) => {
    consoleErrors.push(args)
    realConsoleError(...args)
  }
})
afterEach(() => {
  console.error = realConsoleError
  if (consoleErrors.length) {
    const first = format(...consoleErrors[0]).slice(0, 400)
    throw new Error(`console.error was called ${consoleErrors.length}x during this test. First: ${first}`)
  }
})
