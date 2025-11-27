import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAddAccount } from '../useAddAccount'
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
        useNetwork: vi.fn(() => ({ network: 'mainnet' })),
        useDeviceID: vi.fn(() => 'device-id'),
        useUpdateDeviceMutation: vi.fn(() => ({ mutateAsync: vi.fn(async () => ({})) })),
    }
})

describe('useAddAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
    })

    test('addAccount adds account to store', () => {
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

        const { result } = renderHook(() => useAddAccount())

        const a: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE',
            canSign: true,
        }

        act(() => {
            result.current(a)
        })

        expect(useAccountsStore.getState().accounts).toEqual([a])
        expect(dummySecure.setItem).not.toHaveBeenCalled()
    })
})
