/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { registerAlgorandMultisigAdapter } from '@test-utils/algorandAccountsAdapter'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import {
    useAlgorandAccountSection,
    useHasAlgorandAccountSection,
} from '../useAlgorandAccountSection'

const { mockNavigate, mockRequestBottomSheet } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockRequestBottomSheet: vi.fn(),
}))
const { mockUseCanSignWith, mockUseAccountStateQuery } = vi.hoisted(() => ({
    mockUseCanSignWith: vi.fn(() => true),
    mockUseAccountStateQuery: vi.fn(),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    trackEvent: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useCanSignWith: () => mockUseCanSignWith(),
    useAccountStateQuery: () => mockUseAccountStateQuery(),
}))

const scope = { chainId: 'algorand', networkId: 'mainnet' } as ChainScope

const standardAccount: WalletAccount = {
    id: 'acc-1',
    chains: { algorand: { address: 'ALGO25ADDRESS', keyPairId: 'key-1' } },
    custody: { kind: 'local', seed: null },
}

const sharedAccount: WalletAccount = {
    id: 'acc-6',
    chains: {
        algorand: {
            address: 'MULTISIGADDRESS',
            native: {
                family: 'algorand',
                multisig: {
                    threshold: 2,
                    addresses: ['ALGO25ADDRESS', 'HARDWAREADDRESS'],
                    version: 1,
                },
            },
        },
    },
    custody: { kind: 'multisig' },
}

const renderSection = (account: WalletAccount, onClose = vi.fn()) =>
    renderHook(() => useAlgorandAccountSection({ account, scope, onClose }))

const optionIds = (account: WalletAccount): string[] =>
    renderSection(account).result.current.options.map(option => option.id)

describe('useAlgorandAccountSection', () => {
    beforeEach(() => {
        registerAlgorandMultisigAdapter()
        vi.clearAllMocks()
        useRemoteConfigStore.getState().resetState()
        mockUseCanSignWith.mockReturnValue(true)
        mockUseAccountStateQuery.mockReturnValue({
            data: { reserveBalance: new Decimal(100_000) },
            isLoading: false,
        })
    })

    describe('min balance', () => {
        it('reads the reserve in display units', () => {
            const { result } = renderSection(standardAccount)

            expect(result.current.minBalance?.toString()).toBe('0.1')
            expect(result.current.showMinBalance).toBe(true)
        })

        it('reads no min balance until the state loads', () => {
            mockUseAccountStateQuery.mockReturnValue({
                data: undefined,
                isLoading: true,
            })

            const { result } = renderSection(standardAccount)

            expect(result.current.minBalance).toBeNull()
            expect(result.current.isMinBalanceLoading).toBe(true)
        })

        it('hides it for an account this wallet cannot sign for', () => {
            mockUseCanSignWith.mockReturnValue(false)

            expect(
                renderSection(standardAccount).result.current.showMinBalance,
            ).toBe(false)
        })
    })

    describe('options', () => {
        it('offers rekey, then scan for rekeyed accounts, to a signable account', () => {
            expect(optionIds(standardAccount)).toEqual([
                'rekey-account',
                'scan-rekeyed',
            ])
        })

        it('offers nothing to an account this wallet cannot sign for', () => {
            mockUseCanSignWith.mockReturnValue(false)

            expect(optionIds(standardAccount)).toEqual([])
        })

        it('hides both when rekey is off', () => {
            setCapabilityOverrides({ rekey: false })

            expect(optionIds(standardAccount)).toEqual([])
        })

        it('hides the shared rekey, but not the scan, when multisig is off', () => {
            setCapabilityOverrides({ multisig: false })

            expect(optionIds(sharedAccount)).toEqual(['scan-rekeyed'])
        })
    })

    describe('rekey', () => {
        const pressRekey = async (
            account: WalletAccount,
            onClose = vi.fn(),
        ) => {
            const { result } = renderSection(account, onClose)
            await act(async () => {
                result.current.options
                    .find(option => option.id === 'rekey-account')
                    ?.onPress()
            })
        }

        it.each([
            ['hardware', 'RekeyToLedger', 'RekeyToLedgerIntro'],
            ['standard', 'RekeyToStandard', 'RekeyToStandardIntro'],
            ['postQuantum', 'RekeyToQuantum', 'RekeyToQuantumIntro'],
        ])(
            'closes the sheet and opens the %s intro the type sheet resolves to',
            async (target, stack, screen) => {
                mockRequestBottomSheet.mockResolvedValueOnce(target)
                const onClose = vi.fn()

                await pressRekey(standardAccount, onClose)

                expect(onClose).toHaveBeenCalled()
                expect(mockNavigate).toHaveBeenCalledWith(stack, {
                    screen,
                    params: { sourceAddress: 'ALGO25ADDRESS' },
                })
            },
        )

        it('does not navigate when the type sheet is dismissed', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(undefined)

            await pressRekey(standardAccount)

            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('skips the type sheet for a shared account, which has one destination', async () => {
            await pressRekey(sharedAccount)

            expect(mockRequestBottomSheet).not.toHaveBeenCalled()
            expect(mockNavigate).toHaveBeenCalledWith('RekeyToShared', {
                screen: 'RekeyToSharedIntro',
                params: { sourceAddress: 'MULTISIGADDRESS' },
            })
        })
    })

    it('closes the sheet and opens the rekeyed-account scan', () => {
        const onClose = vi.fn()
        const { result } = renderSection(standardAccount, onClose)

        act(() => {
            result.current.options
                .find(option => option.id === 'scan-rekeyed')
                ?.onPress()
        })

        expect(onClose).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('RescanRekeyed', {
            screen: 'RescanRekeyedSelect',
            params: { sourceAddress: 'ALGO25ADDRESS' },
        })
    })
})

describe('useHasAlgorandAccountSection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('is true for a signable account', () => {
        mockUseCanSignWith.mockReturnValue(true)

        const { result } = renderHook(() =>
            useHasAlgorandAccountSection({
                account: standardAccount,
                scope,
                onClose: vi.fn(),
            }),
        )

        expect(result.current).toBe(true)
        expect(mockUseAccountStateQuery).not.toHaveBeenCalled()
    })

    it('is false for a watch account, which has nothing to show', () => {
        mockUseCanSignWith.mockReturnValue(false)

        const { result } = renderHook(() =>
            useHasAlgorandAccountSection({
                account: { ...standardAccount, custody: { kind: 'watch' } },
                scope,
                onClose: vi.fn(),
            }),
        )

        expect(result.current).toBe(false)
    })
})
