import { renderHook } from '@testing-library/react'
import { useNetworkStatusListener } from '../useNetworkStatusListener'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: vi.fn(),
  },
}))

vi.mock('@tanstack/react-query', () => ({
  onlineManager: {
    setOnline: vi.fn(),
  },
}))

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

const mockSetHasInternet = vi.fn()

vi.mock('../useNetworkStatusStore', () => ({
  useNetworkStatusStore: vi.fn(selector => {
    const state = {
      setHasInternet: mockSetHasInternet,
      hasInternet: true,
    }
    return selector(state)
  }),
}))

describe('useNetworkStatusListener', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('subscribes to NetInfo and updates onlineManager on change', () => {
    // Capture the listener
    let listener: ((state: NetInfoState) => void) | undefined

    const addEventListenerMock = vi
      .mocked(NetInfo.addEventListener)
      .mockImplementation(cb => {
        listener = cb
        return vi.fn()
      })

    const { unmount } = renderHook(() => useNetworkStatusListener())

    expect(addEventListenerMock).toHaveBeenCalled()
    expect(listener).toBeDefined()

    if (listener) {
      // Simulate offline
      listener({ isConnected: false } as NetInfoState)
      expect(mockSetHasInternet).toHaveBeenCalledWith(false)
      expect(onlineManager.setOnline).toHaveBeenCalledWith(false)

      // Simulate online
      listener({ isConnected: true } as NetInfoState)
      expect(mockSetHasInternet).toHaveBeenCalledWith(true)
      expect(onlineManager.setOnline).toHaveBeenCalledWith(true)
    }

    unmount()
  })
})
