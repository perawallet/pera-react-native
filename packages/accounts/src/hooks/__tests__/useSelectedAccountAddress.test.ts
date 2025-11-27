import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSelectedAccountAddress } from '../useSelectedAccountAddress'
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

describe('useSelectedAccountAddress', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [], selectedAccountAddress: null })
    })

    test('returns selected account address and setter', () => {
        useAccountsStore.setState({ selectedAccountAddress: 'A' })

        const { result } = renderHook(() => useSelectedAccountAddress())
        expect(result.current.selectedAccountAddress).toBe('A')

        act(() => {
            result.current.setSelectedAccountAddress('B')
        })
        expect(useAccountsStore.getState().selectedAccountAddress).toBe('B')
    })

    test('returns null when no selected account address', () => {
        const { result } = renderHook(() => useSelectedAccountAddress())
        expect(result.current.selectedAccountAddress).toBeNull()
    })
})
