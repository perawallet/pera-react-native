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
import { useArbitraryDataSigner } from '../useArbitraryDataSigner'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockGetKeyOrThrow = vi.fn()
const mockWithHDSession = vi.fn()
const mockWithAlgo25Session = vi.fn()

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({
        getKeyOrThrow: (...args: any[]) => mockGetKeyOrThrow(...args),
        withHDSession: (...args: any[]) => mockWithHDSession(...args),
        withAlgo25Session: (...args: any[]) => mockWithAlgo25Session(...args),
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

const mockKey = { id: 'key-1', type: 'HDWalletRootKey', publicKey: '' }

const hdAccount = {
    address: 'HD_ADDR',
    keyPairId: 'key-1',
    type: 'hd-wallet',
    hdWalletDetails: { account: 0, keyIndex: 1, derivationType: 9 },
} as unknown as WalletAccount

const algo25Account = {
    address: 'ALGO25_ADDR',
    keyPairId: 'key-1',
    type: 'algo25',
} as unknown as WalletAccount

describe('useArbitraryDataSigner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccounts = []
        mockGetKeyOrThrow.mockReturnValue(mockKey)
        mockIsHDWalletAccount.mockReturnValue(false)
        mockIsAlgo25Account.mockReturnValue(false)
    })

    describe('HD wallet account', () => {
        beforeEach(() => {
            mockIsHDWalletAccount.mockReturnValue(true)
        })

        test('calls session.signData with decoded bytes and no MX prefix', async () => {
            const mockSignData = vi
                .fn()
                .mockResolvedValue(new Uint8Array([9, 8, 7]))
            mockWithHDSession.mockImplementation(
                async (_key: any, _domain: string, handler: any) =>
                    handler({ signData: mockSignData }),
            )

            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(hdAccount, 'hello')
            })

            expect(mockSignData).toHaveBeenCalledTimes(1)
            const [derivationParams, dataArg] = mockSignData.mock.calls[0]

            expect(derivationParams).toEqual({
                account: 0,
                keyIndex: 1,
                derivationType: 9,
            })

            // MX prefix must NOT be present
            expect(dataArg[0]).not.toBe('M'.charCodeAt(0))
            expect(dataArg[1]).not.toBe('X'.charCodeAt(0))
        })

        test('calls withHDSession with SIGNING_KEY_DOMAIN', async () => {
            mockWithHDSession.mockResolvedValue([new Uint8Array([1])])

            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(hdAccount, 'hello')
            })

            expect(mockWithHDSession).toHaveBeenCalledWith(
                mockKey,
                'pera.accounts',
                expect.any(Function),
            )
        })

        test('signs each item in an array of data', async () => {
            const mockSignData = vi.fn().mockResolvedValue(new Uint8Array([1]))
            mockWithHDSession.mockImplementation(
                async (_key: any, _domain: string, handler: any) =>
                    handler({ signData: mockSignData }),
            )

            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(hdAccount, [
                    'item1',
                    'item2',
                    'item3',
                ])
            })

            expect(mockSignData).toHaveBeenCalledTimes(3)
        })

        test('returns signatures from session', async () => {
            const expectedSig = new Uint8Array([42, 43, 44])
            mockWithHDSession.mockImplementation(
                async (_key: any, _domain: string, handler: any) =>
                    handler({
                        signData: vi.fn().mockResolvedValue(expectedSig),
                    }),
            )

            const { result } = renderHook(() => useArbitraryDataSigner())

            let sigs: Uint8Array[] | undefined
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

        test('calls session.signData with MX prefix prepended', async () => {
            const mockSignData = vi
                .fn()
                .mockResolvedValue(new Uint8Array([9, 8, 7]))
            mockWithAlgo25Session.mockImplementation(
                async (_key: any, _domain: string, handler: any) =>
                    handler({ signData: mockSignData }),
            )

            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(algo25Account, 'hello')
            })

            expect(mockSignData).toHaveBeenCalledTimes(1)
            const dataArg = mockSignData.mock.calls[0][0] as Uint8Array

            // MX prefix must be present
            expect(dataArg[0]).toBe('M'.charCodeAt(0))
            expect(dataArg[1]).toBe('X'.charCodeAt(0))
        })

        test('calls withAlgo25Session with SIGNING_KEY_DOMAIN', async () => {
            mockWithAlgo25Session.mockResolvedValue([new Uint8Array([1])])

            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(algo25Account, 'hello')
            })

            expect(mockWithAlgo25Session).toHaveBeenCalledWith(
                mockKey,
                'pera.accounts',
                expect.any(Function),
            )
        })

        test('signs each item in an array of data', async () => {
            const mockSignData = vi.fn().mockResolvedValue(new Uint8Array([1]))
            mockWithAlgo25Session.mockImplementation(
                async (_key: any, _domain: string, handler: any) =>
                    handler({ signData: mockSignData }),
            )

            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(algo25Account, [
                    'item1',
                    'item2',
                ])
            })

            expect(mockSignData).toHaveBeenCalledTimes(2)
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
            mockWithAlgo25Session.mockResolvedValue([new Uint8Array([42])])

            const { result } = renderHook(() => useArbitraryDataSigner())

            await act(async () => {
                await result.current.signArbitraryData(originalAccount, 'hello')
            })

            expect(mockWithAlgo25Session).toHaveBeenCalled()
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
