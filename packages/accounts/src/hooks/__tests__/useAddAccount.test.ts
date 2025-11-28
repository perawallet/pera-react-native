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

const mockMutateAsync = vi.fn(async () => ({}))

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
        useUpdateDeviceMutation: vi.fn(() => ({ mutateAsync: mockMutateAsync })),
    }
})

describe('useAddAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
    })

    test('adds standard account to store and syncs with backend', () => {
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

        const account: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE_ADDRESS',
            canSign: true,
        }

        act(() => {
            result.current(account)
        })

        const accounts = useAccountsStore.getState().accounts
        expect(accounts).toEqual([account])
        expect(dummySecure.setItem).not.toHaveBeenCalled()

        // Verify backend sync was called
        expect(mockMutateAsync).toHaveBeenCalledWith({
            deviceId: 'device-id',
            data: {
                platform: expect.any(String),
                accounts: ['ALICE_ADDRESS'],
            },
        })
    })

    test('adds multiple accounts to store', () => {
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

        const account1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ADDR1',
            canSign: true,
        }

        const account2: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'watch',
            address: 'ADDR2',
            canSign: false,
        }

        act(() => {
            result.current(account1)
        })

        act(() => {
            result.current(account2)
        })

        const accounts = useAccountsStore.getState().accounts
        expect(accounts).toHaveLength(2)
        expect(accounts).toEqual([account1, account2])
    })
})
