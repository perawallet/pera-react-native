import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHasNoAccounts } from '../useHasNoAccounts'
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

describe('useHasNoAccounts', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
    })

    test('returns true when no accounts', () => {
        const { result } = renderHook(() => useHasNoAccounts())
        expect(result.current).toBe(true)
    })

    test('returns false when accounts exist', () => {
        useAccountsStore.setState({ accounts: [{ address: 'A' } as any] })
        const { result } = renderHook(() => useHasNoAccounts())
        expect(result.current).toBe(false)
    })
})
