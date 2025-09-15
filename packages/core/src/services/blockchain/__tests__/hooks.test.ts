import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useAlgorandClient } from '../hooks'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useAppStore } from '../../../store'


// Mock AlgorandClient factory methods so we can assert which one is chosen
vi.mock('@algorandfoundation/algokit-utils', () => {
  return {
    AlgorandClient: {
      testNet: vi.fn(() => 'TESTNET_CLIENT'),
      mainNet: vi.fn(() => 'MAINNET_CLIENT'),
      fromEnvironment: vi.fn(() => 'ENV_CLIENT'),
    },
  }
})

// Mock the zustand-bound store to avoid persistence/container setup for these unit tests
vi.mock('../../../store', () => {
  let state: any = { network: 'mainnet' }
  const useAppStore: any = (selector: any) => selector(state)
  useAppStore.getState = () => state
  useAppStore.setState = (partial: any) => {
    state = { ...state, ...partial }
  }
  return { useAppStore }
})

describe('services/blockchain/hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAppStore as any).setState({ network: 'mainnet' })
  })

  test('returns mainNet client when network is mainnet', () => {
    ;(useAppStore as any).setState({ network: 'mainnet' })
    const { result } = renderHook(() => useAlgorandClient())

    expect(AlgorandClient.mainNet).toHaveBeenCalledTimes(1)
    expect(AlgorandClient.testNet).not.toHaveBeenCalled()
    expect(AlgorandClient.fromEnvironment).not.toHaveBeenCalled()
    expect(result.current).toBe('MAINNET_CLIENT')
  })

  test('returns testNet client when network is testnet', () => {
    ;(useAppStore as any).setState({ network: 'testnet' })
    const { result } = renderHook(() => useAlgorandClient())

    expect(AlgorandClient.testNet).toHaveBeenCalledTimes(1)
    expect(AlgorandClient.mainNet).not.toHaveBeenCalled()
    expect(AlgorandClient.fromEnvironment).not.toHaveBeenCalled()
    expect(result.current).toBe('TESTNET_CLIENT')
  })

  test('returns fromEnvironment client when network is unknown', () => {
    ;(useAppStore as any).setState({ network: 'devnet' as any })
    const { result } = renderHook(() => useAlgorandClient())

    expect(AlgorandClient.fromEnvironment).toHaveBeenCalledTimes(1)
    expect(AlgorandClient.testNet).not.toHaveBeenCalled()
    expect(AlgorandClient.mainNet).not.toHaveBeenCalled()
    expect(result.current).toBe('ENV_CLIENT')
  })
})