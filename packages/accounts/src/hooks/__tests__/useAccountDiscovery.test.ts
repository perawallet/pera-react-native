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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccountDiscovery } from '../useAccountDiscovery'
import { KEY_DOMAIN } from '../../constants'

const mockBaseDiscoverAccounts = vi.fn()
const mockBaseDiscoverRekeyedAccounts = vi.fn()

vi.mock('../../account-discovery', () => ({
    discoverAccounts: (...args: unknown[]) => mockBaseDiscoverAccounts(...args),
    discoverRekeyedAccounts: (...args: unknown[]) =>
        mockBaseDiscoverRekeyedAccounts(...args),
}))

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 9 },
}))

const kmsMock = vi.hoisted(() => ({
    withHDSession: vi.fn(),
    getKeyOrThrow: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => kmsMock,
}))

describe('useAccountDiscovery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        kmsMock.withHDSession.mockImplementation(
            async (_key, _domain, handler) => handler('SESSION'),
        )
        kmsMock.getKeyOrThrow.mockReturnValue('KEY')
        mockBaseDiscoverAccounts.mockResolvedValue(['acc'])
        mockBaseDiscoverRekeyedAccounts.mockResolvedValue(['rekeyed'])
    })

    describe('discoverAccounts', () => {
        it('opens an HD session with the resolved key and delegates', async () => {
            const { result } = renderHook(() => useAccountDiscovery())

            let discovered: unknown
            await act(async () => {
                discovered = await result.current.discoverAccounts({
                    walletKeyId: 'WALLET1',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    derivationType: 9 as any,
                    accountGapLimit: 3,
                    keyIndexGapLimit: 2,
                })
            })

            expect(kmsMock.getKeyOrThrow).toHaveBeenCalledWith('WALLET1')
            expect(kmsMock.withHDSession).toHaveBeenCalledWith(
                'KEY',
                KEY_DOMAIN,
                expect.any(Function),
            )
            expect(mockBaseDiscoverAccounts).toHaveBeenCalledWith({
                walletKeyId: 'WALLET1',
                derivationType: 9,
                accountGapLimit: 3,
                keyIndexGapLimit: 2,
                session: 'SESSION',
            })
            expect(discovered).toEqual(['acc'])
        })
    })

    describe('discoverRekeyedAccounts', () => {
        it('skips the HD session when account addresses are provided', async () => {
            const { result } = renderHook(() => useAccountDiscovery())

            await act(async () => {
                await result.current.discoverRekeyedAccounts({
                    walletKeyId: 'WALLET1',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    derivationType: 9 as any,
                    accountAddresses: ['A', 'B'],
                })
            })

            expect(kmsMock.withHDSession).not.toHaveBeenCalled()
            expect(kmsMock.getKeyOrThrow).not.toHaveBeenCalled()
            expect(mockBaseDiscoverRekeyedAccounts).toHaveBeenCalledWith(
                expect.objectContaining({
                    walletKeyId: 'WALLET1',
                    accountAddresses: ['A', 'B'],
                    session: null,
                }),
            )
        })

        it('opens an HD session when no addresses are provided', async () => {
            const { result } = renderHook(() => useAccountDiscovery())

            await act(async () => {
                await result.current.discoverRekeyedAccounts({
                    walletKeyId: 'WALLET1',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    derivationType: 9 as any,
                })
            })

            expect(kmsMock.getKeyOrThrow).toHaveBeenCalledWith('WALLET1')
            expect(kmsMock.withHDSession).toHaveBeenCalled()
            expect(mockBaseDiscoverRekeyedAccounts).toHaveBeenCalledWith(
                expect.objectContaining({
                    walletKeyId: 'WALLET1',
                    session: 'SESSION',
                }),
            )
        })

        it('opens an HD session when addresses array is empty', async () => {
            const { result } = renderHook(() => useAccountDiscovery())

            await act(async () => {
                await result.current.discoverRekeyedAccounts({
                    walletKeyId: 'WALLET1',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    derivationType: 9 as any,
                    accountAddresses: [],
                })
            })

            expect(kmsMock.withHDSession).toHaveBeenCalled()
        })
    })
})
