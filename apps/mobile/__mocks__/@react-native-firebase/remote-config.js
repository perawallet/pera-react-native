import { vi } from 'vitest'

const getRemoteConfig = () => ({
  setDefaults: vi.fn(async () => { }),
  fetchAndActivate: vi.fn(async () => true),
  setConfigSettings: vi.fn(),
  getValue: vi.fn(() => ({
    asString: () => '',
    asBoolean: () => false,
    asNumber: () => 0,
  })),
})

export default { getRemoteConfig }
export { getRemoteConfig }
