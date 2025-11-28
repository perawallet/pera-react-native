import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAllAccounts } from '../useAllAccounts'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

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

describe('useAllAccounts', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
    })

    test('returns all accounts from store', () => {
        const { result } = renderHook(() => useAllAccounts())
        expect(result.current).toEqual([])

        const accounts: WalletAccount[] = [
            { id: '1', address: 'A', type: 'standard', canSign: true, name: 'A' },
            { id: '2', address: 'B', type: 'standard', canSign: true, name: 'B' },
        ]
        useAccountsStore.setState({ accounts })

        const { result: result2 } = renderHook(() => useAllAccounts())
        expect(result2.current).toEqual(accounts)
    })

    test('returns all accounts from store when store is empty', () => {
        const { result } = renderHook(() => useAllAccounts())
        expect(result.current).toEqual([])
    })
})
