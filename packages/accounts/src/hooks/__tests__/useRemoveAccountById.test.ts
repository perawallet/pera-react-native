import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRemoveAccountById } from '../useRemoveAccountById'
import { useAccountsStore } from '../../store'
import { registerTestPlatform, MemoryKeyValueStorage } from '@perawallet/wallet-core-platform-integration'
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

vi.mock('@perawallet/wallet-core-platform-integration', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-platform-integration')
    >('@perawallet/wallet-core-platform-integration')
    return {
        ...actual,
        useKeyValueStorageService: vi.fn().mockReturnValue({
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        }),
    }
})

describe('useRemoveAccountById', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
    })

    test('removeAccountById removes account and clears persisted PK', () => {
        const dummySecure = {
            setItem: vi.fn(async () => { }),
            getItem: vi.fn(async () => null),
            removeItem: vi.fn(async () => { }),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const a: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE',
            canSign: true,
            privateKeyLocation: 'device',
        }
        useAccountsStore.setState({ accounts: [a] })

        const { result } = renderHook(() => useRemoveAccountById())

        act(() => {
            result.current('1')
        })

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(dummySecure.removeItem).toHaveBeenCalledWith('pk-ALICE')
    })
})
