import { vi } from 'vitest'

const getMessaging = () => ({
  registerDeviceForRemoteMessages: vi.fn(),
  onMessage: vi.fn(() => vi.fn()),
  getToken: vi.fn(async () => 'token'),
})

export default { getMessaging }
export { getMessaging }
