/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useArbitraryDataSigner } from '../useArbitraryDataSigner'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockSignDataWithKey = vi.fn()

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({
        signDataWithKey: (...args: any[]) => mockSignDataWithKey(...args),
    }),
}))

let mockAccounts: WalletAccount[] = []

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAccountsStore: (selector: any) =>
            selector({ accounts: mockAccounts }),
    }
})

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        decodeFromBase64: (s: string) => new TextEncoder().encode(s),
    }
})

const hdAccount = {
    address: 'HD_ADDR',
    keyPairId: 'key-hd-child',
    type: 'hdWallet',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 1,
        derivationType: 9,
    },
} as unknown as WalletAccount

const algo25Account = {
    address: 'ALGO25_ADDR',
    keyPairId: 'key-algo25-ed25519',
    type: 'algo25',
} as unknown as WalletAccount

describe('useArbitraryDataSigner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccounts = []
        mockSignDataWithKey.mockResolvedValue([new Uint8Array([9, 8, 7])])
    })

    describe('HD wallet account', () => {
        test('signs with the account child id and MX-prefixed bytes', async () => {
            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(hdAccount, 'hello')
            })

            expect(mockSignDataWithKey).toHaveBeenCalledTimes(1)
            const [childId, domain, items] = mockSignDataWithKey.mock.calls[0]

            expect(childId).toBe('key-hd-child')
            expect(domain).toBe('pera.accounts')
            expect(items).toHaveLength(1)

            const dataArg = items[0] as Uint8Array
            expect(dataArg[0]).toBe('M'.charCodeAt(0))
            expect(dataArg[1]).toBe('X'.charCodeAt(0))
        })

        test('signs each item in an array of data', async () => {
            mockSignDataWithKey.mockResolvedValue([
                new Uint8Array([1]),
                new Uint8Array([2]),
                new Uint8Array([3]),
            ])

            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(hdAccount, [
                    'item1',
                    'item2',
                    'item3',
                ])
            })

            const [, , items] = mockSignDataWithKey.mock.calls[0]
            expect(items).toHaveLength(3)
        })

        test('returns signatures from the kms call', async () => {
            const expectedSig = new Uint8Array([42, 43, 44])
            mockSignDataWithKey.mockResolvedValue([expectedSig])

            const { result } = renderHook(() => useArbitraryDataSigner())

            let sigs: Optional<Uint8Array[]>
            await act(async () => {
                sigs = await result.current.signArbitraryData(
                    hdAccount,
                    'hello',
                )
            })

            expect(sigs).toEqual([expectedSig])
        })
    })

    describe('Algo25 account', () => {
        test('signs with the account child id and MX-prefixed bytes', async () => {
            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(algo25Account, 'hello')
            })

            expect(mockSignDataWithKey).toHaveBeenCalledTimes(1)
            const [childId, domain, items] = mockSignDataWithKey.mock.calls[0]
            expect(childId).toBe('key-algo25-ed25519')
            expect(domain).toBe('pera.accounts')

            const dataArg = items[0] as Uint8Array
            expect(dataArg[0]).toBe('M'.charCodeAt(0))
            expect(dataArg[1]).toBe('X'.charCodeAt(0))
        })
    })

    describe('rekeyed accounts', () => {
        test("signs with the requested account's OWN key even when rekeyed", async () => {
            // The dApp verifies the signature against the requested address's
            // own pubkey, so we use the account's own keypair — never the
            // auth chain.
            const original = {
                ...algo25Account,
                address: 'ORIGINAL_ADDR',
                rekeyAddress: 'AUTH_ADDR',
            } as unknown as WalletAccount

            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(original, 'hello')
            })

            const [childId] = mockSignDataWithKey.mock.calls[0]
            expect(childId).toBe('key-algo25-ed25519')
        })

        test('rejects a watch-rekeyed account even when the auth has keys', async () => {
            const watchSource = {
                address: 'WATCH_ADDR',
                type: 'watch',
                rekeyAddress: 'AUTH_ADDR',
            } as unknown as WalletAccount

            const { result } = renderHook(() => useArbitraryDataSigner())

            await expect(
                act(async () => {
                    await result.current.signArbitraryData(watchSource, 'hello')
                }),
            ).rejects.toThrow(/Cannot sign arbitrary data/)
        })
    })

    describe('unsupported account type', () => {
        test('rejects watch accounts', async () => {
            const watchAccount = {
                address: 'WATCH_ADDR',
                type: 'watch',
            } as unknown as WalletAccount

            const { result } = renderHook(() => useArbitraryDataSigner())

            await expect(
                act(async () => {
                    await result.current.signArbitraryData(
                        watchAccount,
                        'hello',
                    )
                }),
            ).rejects.toThrow(/Cannot sign arbitrary data/)
        })

        test('rejects hardware wallet accounts', async () => {
            const hwAccount = {
                address: 'HW_ADDR',
                type: 'hardware',
                hardwareDetails: {
                    manufacturer: 'ledger',
                    deviceId: 'd',
                    deviceName: 'L',
                    accountIndex: 0,
                    transportType: 'ble',
                },
            } as unknown as WalletAccount

            const { result } = renderHook(() => useArbitraryDataSigner())

            await expect(
                act(async () => {
                    await result.current.signArbitraryData(hwAccount, 'hello')
                }),
            ).rejects.toThrow(/Cannot sign arbitrary data/)
        })
    })
})
