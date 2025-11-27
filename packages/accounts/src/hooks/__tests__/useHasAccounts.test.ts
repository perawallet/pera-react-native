import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHasAccounts } from '../useHasAccounts'
import { useAccountsStore } from '../../store'

vi.mock('../../store', async () => {
    const actual = await vi.importActual<typeof import('../../store')>('../../store')
    const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }
    return {
        ...actual,
        useAccountsStore: actual.createAccountsStore(mockStorage as any),
    }
})

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useKeyValueStorageService: vi.fn().mockReturnValue({
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }),
}))

describe('useHasAccounts', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
    })

    test('returns false when no accounts', () => {
        const { result } = renderHook(() => useHasAccounts())
        expect(result.current).toBe(false)
    })

    test('returns true when accounts exist', () => {
        useAccountsStore.setState({ accounts: [{ address: 'A' } as any] })
        const { result } = renderHook(() => useHasAccounts())
        expect(result.current).toBe(true)
    })
})
