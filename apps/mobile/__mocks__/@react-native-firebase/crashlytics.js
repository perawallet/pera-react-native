import { vi } from 'vitest'

const getCrashlytics = () => ({
  setCrashlyticsCollectionEnabled: vi.fn(),
  recordError: vi.fn(),
  log: vi.fn(),
})

export default { getCrashlytics }
export { getCrashlytics }
