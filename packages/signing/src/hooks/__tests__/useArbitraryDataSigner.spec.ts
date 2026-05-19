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

const mockIsHDWalletAccount = vi.fn()
const mockIsAlgo25Account = vi.fn()
let mockAccounts: WalletAccount[] = []

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: (selector: any) => selector({ accounts: mockAccounts }),
    isHDWalletAccount: (...args: any[]) => mockIsHDWalletAccount(...args),
    isAlgo25Account: (...args: any[]) => mockIsAlgo25Account(...args),
}))

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
    type: 'hd-wallet',
    hdWalletDetails: { account: 0, keyIndex: 1, derivationType: 9 },
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
        mockIsHDWalletAccount.mockReturnValue(false)
        mockIsAlgo25Account.mockReturnValue(false)
        mockSignDataWithKey.mockResolvedValue([new Uint8Array([9, 8, 7])])
    })

    describe('HD wallet account', () => {
        beforeEach(() => {
            mockIsHDWalletAccount.mockReturnValue(true)
        })

        test('calls signDataWithKey with the account child id and MX-prefixed bytes', async () => {
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
            // dApps verifying via the legacy algo_signData spec expect
            // signatures over `MX || data`, so the wallet must prepend it.
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
        beforeEach(() => {
            mockIsAlgo25Account.mockReturnValue(true)
        })

        test('calls signDataWithKey with the account child id and MX-prefixed bytes', async () => {
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

        test('signs each item in an array of data', async () => {
            mockSignDataWithKey.mockResolvedValue([
                new Uint8Array([1]),
                new Uint8Array([2]),
            ])

            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(algo25Account, [
                    'item1',
                    'item2',
                ])
            })

            const [, , items] = mockSignDataWithKey.mock.calls[0]
            expect(items).toHaveLength(2)
        })
    })

    describe('rekeyed accounts', () => {
        test('delegates signing to the rekeyed account', async () => {
            const rekeyedAccount = {
                ...algo25Account,
                address: 'REKEYED_ADDR',
            }
            const originalAccount = {
                ...algo25Account,
                address: 'ORIGINAL_ADDR',
                rekeyAddress: 'REKEYED_ADDR',
            } as unknown as WalletAccount

            mockAccounts = [rekeyedAccount as unknown as WalletAccount]
            mockIsAlgo25Account.mockReturnValue(true)
            mockSignDataWithKey.mockResolvedValue([new Uint8Array([42])])

            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(originalAccount, 'hello')
            })

            expect(mockSignDataWithKey).toHaveBeenCalled()
        })

        test('rejects when rekeyed account is not found', async () => {
            const originalAccount = {
                ...algo25Account,
                address: 'ORIGINAL_ADDR',
                rekeyAddress: 'MISSING_ADDR',
            } as unknown as WalletAccount

            mockAccounts = []

            const { result } = renderHook(() => useArbitraryDataSigner())

            await expect(
                act(async () => {
                    await result.current.signArbitraryData(
                        originalAccount,
                        'hello',
                    )
                }),
            ).rejects.toMatch('No rekeyed account found for MISSING_ADDR')
        })
    })

    describe('unsupported account type', () => {
        test('rejects with unsupported account type message', async () => {
            const watchAccount = {
                address: 'WATCH_ADDR',
                keyPairId: 'key-1',
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
            ).rejects.toMatch('Unsupported account type watch for WATCH_ADDR')
        })
    })
})
