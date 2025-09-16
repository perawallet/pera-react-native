import { describe, test, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { WalletAccount } from '../types'
import { MemoryKeyValueStorage, registerTestPlatform } from '@test-utils'

describe('services/accounts/hooks', () => {
  test('getDisplayAddress permutations', async () => {
    vi.resetModules()

    const { useDisplayAddress } = await import('../hooks')

    const a1: WalletAccount = {
      id: '1',
      type: 'standard',
      address: 'SHORT',
    }
    const { result } = renderHook(() => useDisplayAddress(a1))
    expect(result.current).toEqual("SHORT")

    const a2: WalletAccount = {
      id: '1',
      type: 'standard',
      address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    }
    const { result: result2 } = renderHook(() => useDisplayAddress(a2))
    expect(result2.current).toEqual("ABCDE...VWXYZ")

    const a3: WalletAccount = {
      id: '1',
      type: 'standard',
      address: 'ABCDEFGHIJKL',
    }
    const { result: result3 } = renderHook(() => useDisplayAddress(a3))
    expect(result3.current).toEqual("ABCDE...HIJKL")

    const a4: WalletAccount = {
      id: '1',
      name: 'Named',
      type: 'standard',
      address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    }
    const { result: result4 } = renderHook(() => useDisplayAddress(a4))
    expect(result4.current).toEqual("Named")
  })

  test('getAllAccounts, findAccountByAddress, and addAccount persist PK when provided', async () => {
    vi.resetModules()

    const dummySecure = {
      setItem: vi.fn(async (_k: string, _v: string) => {}),
      getItem: vi.fn(async (_k: string) => null),
      removeItem: vi.fn(async (_k: string) => {}),
      authenticate: vi.fn(async () => true),
    }

    registerTestPlatform({
      keyValueStorage: new MemoryKeyValueStorage() as any,
      secureStorage: dummySecure as any,
    })

    const { useAppStore } = await import('../../../store')
    const { useAccounts } = await import('../hooks')

    const { result } = renderHook(() => useAccounts())

    // defaults
    expect(result.current.getAllAccounts()).toEqual([])

    const a1: WalletAccount = {
      id: '1',
      name: 'Alice',
      type: 'standard',
      address: 'ALICE',
    }

    // add with secret - should persist to secure storage
    act(() => {
      result.current.addAccount(a1, 'secret')
    })
    expect(useAppStore.getState().accounts).toEqual([a1])
    expect(dummySecure.setItem).toHaveBeenCalledWith('pk-ALICE', 'secret')

    // find present / absent
    expect(result.current.findAccountByAddress('ALICE')).toEqual(a1)
    expect(result.current.findAccountByAddress('MISSING')).toBeNull()
  })

  test('addAccount without secret does not persist PK', async () => {
    vi.resetModules()

    const dummySecure = {
      setItem: vi.fn(async (_k: string, _v: string) => {}),
      getItem: vi.fn(async (_k: string) => null),
      removeItem: vi.fn(async (_k: string) => {}),
      authenticate: vi.fn(async () => true),
    }

    registerTestPlatform({
      keyValueStorage: new MemoryKeyValueStorage() as any,
      secureStorage: dummySecure as any,
    })

    const { useAppStore } = await import('../../../store')
    const { useAccounts } = await import('../hooks')

    const { result } = renderHook(() => useAccounts())

    const a: WalletAccount = {
      id: '2',
      name: 'Bob',
      type: 'standard',
      address: 'BOB',
    }

    act(() => {
      result.current.addAccount(a)
    })
    expect(useAppStore.getState().accounts).toEqual([a])
    expect(dummySecure.setItem).not.toHaveBeenCalled()
  })

  test('removeAccountById removes and clears persisted PK when privateKeyLocation is set', async () => {
    vi.resetModules()

    const dummySecure = {
      setItem: vi.fn(async (_k: string, _v: string) => {}),
      getItem: vi.fn(async (_k: string) => null),
      removeItem: vi.fn(async (_k: string) => {}),
      authenticate: vi.fn(async () => true),
    }

    registerTestPlatform({
      keyValueStorage: new MemoryKeyValueStorage() as any,
      secureStorage: dummySecure as any,
    })

    const { useAppStore } = await import('../../../store')
    const { useAccounts } = await import('../hooks')

    const { result } = renderHook(() => useAccounts())

    const a: WalletAccount = {
      id: '3',
      name: 'Carol',
      type: 'standard',
      address: 'CAROL',
      privateKeyLocation: 'device',
    }

    act(() => {
      result.current.addAccount(a)
    })
    expect(useAppStore.getState().accounts).toEqual([a])

    act(() => {
      result.current.removeAccountById('3')
    })
    expect(useAppStore.getState().accounts).toEqual([])
    expect(dummySecure.removeItem).toHaveBeenCalledWith('pk-CAROL')
  })

  test('removeAccountByAddress removes and clears persisted PK when privateKeyLocation is set', async () => {
    vi.resetModules()

    const dummySecure = {
      setItem: vi.fn(async (_k: string, _v: string) => {}),
      getItem: vi.fn(async (_k: string) => null),
      removeItem: vi.fn(async (_k: string) => {}),
      authenticate: vi.fn(async () => true),
    }

    registerTestPlatform({
      keyValueStorage: new MemoryKeyValueStorage() as any,
      secureStorage: dummySecure as any,
    })

    const { useAppStore } = await import('../../../store')
    const { useAccounts } = await import('../hooks')

    const { result } = renderHook(() => useAccounts())

    const a: WalletAccount = {
      id: '4',
      name: 'Dave',
      type: 'standard',
      address: 'DAVE',
      privateKeyLocation: 'device',
    }

    act(() => {
      result.current.addAccount(a)
    })
    expect(useAppStore.getState().accounts).toEqual([a])

    act(() => {
      result.current.removeAccountByAddress('DAVE')
    })
    expect(useAppStore.getState().accounts).toEqual([])
    expect(dummySecure.removeItem).toHaveBeenCalledWith('pk-DAVE')
  })
})
