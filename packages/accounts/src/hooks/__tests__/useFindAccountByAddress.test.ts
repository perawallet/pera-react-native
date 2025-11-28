import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFindAccountByAddress } from '../useFindAccountByAddress'
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

describe('useFindAccountByAddress', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
    })

    test('finds account by address', () => {
        const accounts: WalletAccount[] = [
            { id: '1', address: 'A', type: 'standard', canSign: true, name: 'A' },
            { id: '2', address: 'B', type: 'standard', canSign: true, name: 'B' },
        ]
        useAccountsStore.setState({ accounts })

        const { result } = renderHook(() => useFindAccountByAddress('A'))
        expect(result.current).toEqual(accounts[0])

        const { result: result2 } = renderHook(() => useFindAccountByAddress('C'))
        expect(result2.current).toBeNull()
    })

    test('handles empty store', () => {
        const { result } = renderHook(() => useFindAccountByAddress('A'))
        expect(result.current).toBeNull()
    })
})
