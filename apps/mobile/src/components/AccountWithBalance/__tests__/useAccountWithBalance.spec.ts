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

import { renderHook } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type {
    AccountValueBasis,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import {
    crossChainTotalOf,
    useAccountWithBalance,
} from '../useAccountWithBalance'

const mockIsSwitchedOff = vi.fn()
const mockBasis = { current: 'native' as AccountValueBasis }
const mockHoldingSources = vi.fn()
const mockTotalsQuery = vi.fn()
const mockMultisigParameters = vi.fn()
const mockAccountValueTotals = new Map<
    string,
    {
        nativeValue: Decimal | null
        fiatValue?: Decimal | null
        isPending?: boolean
    }
>()

vi.mock('@perawallet/wallet-core-accounts', () => {
    const chainOf = (account: WalletAccount) =>
        Object.keys(account.chains)[0] as string
    return {
        useAccountChainId: chainOf,
        useAccountValueBasis: () => mockBasis.current,
        accountValueKey: (chainId: string, address: string) =>
            `${chainId}|${address}`,
        accountValueOf: (
            account: WalletAccount,
            chainId: string,
            values: Map<string, unknown>,
        ) =>
            values.get(
                `${chainId}|${
                    (account.chains as Record<string, { address: string }>)[
                        chainId
                    ]?.address ?? ''
                }`,
            ),
        useAccountValueTotalsQuery: (...args: unknown[]) => {
            mockTotalsQuery(...args)
            return { accountValueTotals: mockAccountValueTotals }
        },
        useAccountHoldingSources: (account: WalletAccount) =>
            mockHoldingSources(account),
        isWatchAccount: (account: WalletAccount) =>
            account.custody.kind === 'watch',
        multisigParametersOf: (account: WalletAccount, chainId: string) =>
            mockMultisigParameters(account, chainId),
    }
})

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        usdToPreferred: (value: Decimal | null | undefined) =>
            value ? value.times(2) : null,
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    findNativeAsset: (chainId: string) => ({
        assetId: chainId === 'ethereum' ? 'eth' : '0',
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useIsChainSwitchedOff: (chainId: string) => mockIsSwitchedOff(chainId),
}))

const ALGO_ADDRESS = 'A'.repeat(58)
const ETH_ADDRESS = `0x${'b'.repeat(40)}`

const ALGO_ACCOUNT: WalletAccount = {
    id: 'account-1',
    custody: { kind: 'watch' },
    chains: { algorand: { address: ALGO_ADDRESS } },
}

const ETH_ACCOUNT: WalletAccount = {
    id: 'account-2',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: ETH_ADDRESS } },
}

const BOTH_CHAINS: WalletAccount = {
    ...ALGO_ACCOUNT,
    chains: {
        algorand: { address: ALGO_ADDRESS },
        ethereum: { address: ETH_ADDRESS },
    },
}

describe('useAccountWithBalance', () => {
    beforeAll(() => {
        registerEthereumChain()
    })

    beforeEach(() => {
        mockIsSwitchedOff.mockReset().mockReturnValue(false)
        mockBasis.current = 'native'
        mockAccountValueTotals.clear()
        mockTotalsQuery.mockReset()
        mockMultisigParameters.mockReset().mockReturnValue(undefined)
        mockHoldingSources
            .mockReset()
            .mockImplementation((account: WalletAccount) =>
                Object.entries(account.chains).map(([chainId, entry]) => ({
                    address: (entry as { address: string }).address,
                    scope: { chainId, networkId: 'mainnet' },
                })),
            )
    })

    it("reads the given chain's address, scope and native asset over the account's own chain", () => {
        mockAccountValueTotals.set(`algorand|${ALGO_ADDRESS}`, {
            nativeValue: new Decimal(1),
        })
        mockAccountValueTotals.set(`ethereum|${ETH_ADDRESS}`, {
            nativeValue: new Decimal(2),
        })

        const { result } = renderHook(() =>
            useAccountWithBalance(BOTH_CHAINS, 'ethereum'),
        )

        expect(result.current.nativeValue).toEqual(new Decimal(2))
        expect(result.current.scope.chainId).toBe('ethereum')
        expect(result.current.availability).toEqual({
            isAvailable: true,
            nativeAsset: { assetId: 'eth' },
        })
    })

    it('values an Algorand-only wallet in its native asset and fiat', () => {
        mockAccountValueTotals.set(`algorand|${ALGO_ADDRESS}`, {
            nativeValue: new Decimal(12),
            fiatValue: new Decimal(24),
        })

        const { result } = renderHook(() => useAccountWithBalance(ALGO_ACCOUNT))

        expect(result.current).toMatchObject({
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            availability: { isAvailable: true, nativeAsset: { assetId: '0' } },
            nativeValue: new Decimal(12),
            isMultiChain: false,
        })
    })

    it("reads an Ethereum account's native balance on its own chain", () => {
        registerEthereumChain()
        mockBasis.current = 'fiat'
        mockAccountValueTotals.set(`ethereum|${ETH_ADDRESS}`, {
            nativeValue: new Decimal('1.5'),
            fiatValue: new Decimal(3000),
        })

        const { result } = renderHook(() => useAccountWithBalance(ETH_ACCOUNT))

        expect(result.current).toMatchObject({
            scope: { chainId: 'ethereum', networkId: 'mainnet' },
            chainName: 'Ethereum',
            availability: {
                isAvailable: true,
                nativeAsset: { assetId: 'eth' },
            },
            nativeValue: new Decimal('1.5'),
            isMultiChain: true,
        })
    })

    it('keeps an unknown native value unknown rather than 0', () => {
        mockAccountValueTotals.set(`ethereum|${ETH_ADDRESS}`, {
            nativeValue: null,
            fiatValue: null,
        })

        const { result } = renderHook(() => useAccountWithBalance(ETH_ACCOUNT))

        expect(result.current.nativeValue).toBeNull()
    })

    describe('preferredValue', () => {
        beforeEach(() => {
            mockBasis.current = 'fiat'
        })

        it("is the account's fiat value in the preferred currency", () => {
            mockAccountValueTotals.set(`ethereum|${ETH_ADDRESS}`, {
                nativeValue: new Decimal('1.5'),
                fiatValue: new Decimal(3000),
            })

            const { result } = renderHook(() =>
                useAccountWithBalance(ETH_ACCOUNT),
            )

            expect(result.current.preferredValue).toEqual(new Decimal(6000))
        })

        it('is unknown, not 0, when the balance has no price', () => {
            mockAccountValueTotals.set(`ethereum|${ETH_ADDRESS}`, {
                nativeValue: new Decimal('5.77'),
                fiatValue: null,
            })

            const { result } = renderHook(() =>
                useAccountWithBalance(ETH_ACCOUNT),
            )

            expect(result.current.preferredValue).toBeNull()
        })

        it('is unknown when the native balance is unpriced, even with priced tokens', () => {
            mockAccountValueTotals.set(`ethereum|${ETH_ADDRESS}`, {
                nativeValue: null,
                fiatValue: null,
            })

            const { result } = renderHook(() =>
                useAccountWithBalance(ETH_ACCOUNT),
            )

            expect(result.current.preferredValue).toBeNull()
        })

        it('is a real 0 for a zero balance', () => {
            mockAccountValueTotals.set(`ethereum|${ETH_ADDRESS}`, {
                nativeValue: new Decimal(0),
                fiatValue: new Decimal(0),
            })

            const { result } = renderHook(() =>
                useAccountWithBalance(ETH_ACCOUNT),
            )

            expect(result.current.preferredValue).toEqual(new Decimal(0))
        })

        it('is undefined until the totals have loaded', () => {
            mockAccountValueTotals.set(`algorand|${ALGO_ADDRESS}`, {
                nativeValue: new Decimal(0),
                fiatValue: new Decimal(0),
                isPending: true,
            })

            const { result: pending } = renderHook(() =>
                useAccountWithBalance(ALGO_ACCOUNT),
            )
            const { result: missing } = renderHook(() =>
                useAccountWithBalance(ETH_ACCOUNT),
            )

            expect(pending.current.preferredValue).toBeUndefined()
            expect(missing.current.preferredValue).toBeUndefined()
        })
    })

    it("flags an account whose chain's kill switch is off", () => {
        mockIsSwitchedOff.mockReturnValue(true)

        const { result } = renderHook(() => useAccountWithBalance(ETH_ACCOUNT))

        expect(mockIsSwitchedOff).toHaveBeenCalledWith('ethereum')
        expect(result.current.availability).toEqual({ isAvailable: false })
    })

    describe('crossChainTotal', () => {
        beforeEach(() => {
            mockBasis.current = 'fiat'
        })

        it('is unset on a row scoped to one chain', () => {
            const { result } = renderHook(() =>
                useAccountWithBalance(BOTH_CHAINS, 'ethereum'),
            )

            expect(result.current.crossChainTotal).toBeUndefined()
        })

        it('is set while the wallet holds a single chain, so every row reads in fiat', () => {
            mockBasis.current = 'native'
            mockAccountValueTotals.set(`algorand|${ALGO_ADDRESS}`, {
                nativeValue: new Decimal(1),
                fiatValue: new Decimal(10),
            })

            const { result } = renderHook(() =>
                useAccountWithBalance(ALGO_ACCOUNT),
            )

            expect(result.current.crossChainTotal).toEqual({
                kind: 'fiat',
                value: new Decimal(20),
            })
        })

        it("sums the account's fiat value across its chains, in the preferred currency", () => {
            mockAccountValueTotals.set(`algorand|${ALGO_ADDRESS}`, {
                nativeValue: new Decimal(1),
                fiatValue: new Decimal(10),
            })
            mockAccountValueTotals.set(`ethereum|${ETH_ADDRESS}`, {
                nativeValue: new Decimal(2),
                fiatValue: new Decimal(20),
            })

            const { result } = renderHook(() =>
                useAccountWithBalance(BOTH_CHAINS),
            )

            expect(result.current.crossChainTotal).toEqual({
                kind: 'fiat',
                value: new Decimal(60),
            })
        })

        it('counts each EVM chain at a shared address on its own', () => {
            const onThreeChains: WalletAccount = {
                ...BOTH_CHAINS,
                chains: {
                    ...BOTH_CHAINS.chains,
                    base: { address: ETH_ADDRESS },
                },
            }
            mockAccountValueTotals.set(`algorand|${ALGO_ADDRESS}`, {
                nativeValue: new Decimal(1),
                fiatValue: new Decimal(10),
            })
            mockAccountValueTotals.set(`ethereum|${ETH_ADDRESS}`, {
                nativeValue: new Decimal(2),
                fiatValue: new Decimal(20),
            })
            mockAccountValueTotals.set(`base|${ETH_ADDRESS}`, {
                nativeValue: new Decimal(0),
                fiatValue: new Decimal(5),
            })

            const { result } = renderHook(() =>
                useAccountWithBalance(onThreeChains),
            )

            expect(result.current.crossChainTotal).toEqual({
                kind: 'fiat',
                value: new Decimal(70),
            })
        })

        it('is unknown, not a partial sum, when one chain is unpriced', () => {
            mockAccountValueTotals.set(`algorand|${ALGO_ADDRESS}`, {
                nativeValue: new Decimal(1),
                fiatValue: new Decimal(10),
            })
            mockAccountValueTotals.set(`ethereum|${ETH_ADDRESS}`, {
                nativeValue: new Decimal(2),
                fiatValue: null,
            })

            const { result } = renderHook(() =>
                useAccountWithBalance(BOTH_CHAINS),
            )

            expect(result.current.crossChainTotal).toEqual({
                kind: 'fiat',
                value: null,
            })
        })

        it("is still loading while any chain's totals are", () => {
            mockAccountValueTotals.set(`algorand|${ALGO_ADDRESS}`, {
                nativeValue: new Decimal(1),
                fiatValue: null,
            })
            mockAccountValueTotals.set(`ethereum|${ETH_ADDRESS}`, {
                nativeValue: new Decimal(0),
                fiatValue: new Decimal(0),
                isPending: true,
            })

            const { result } = renderHook(() =>
                useAccountWithBalance(BOTH_CHAINS),
            )

            expect(result.current.crossChainTotal).toEqual({
                kind: 'fiat',
                value: undefined,
            })
        })

        it('leaves holdings on a test network out of the total', () => {
            mockHoldingSources.mockReturnValue([
                {
                    address: ALGO_ADDRESS,
                    scope: { chainId: 'algorand', networkId: 'testnet' },
                },
                {
                    address: ETH_ADDRESS,
                    scope: { chainId: 'ethereum', networkId: 'mainnet' },
                },
            ])
            mockAccountValueTotals.set(`algorand|${ALGO_ADDRESS}`, {
                nativeValue: new Decimal(1),
                fiatValue: new Decimal(10),
            })
            mockAccountValueTotals.set(`ethereum|${ETH_ADDRESS}`, {
                nativeValue: new Decimal(2),
                fiatValue: new Decimal(20),
            })

            const { result } = renderHook(() =>
                useAccountWithBalance(BOTH_CHAINS),
            )

            expect(result.current.crossChainTotal).toEqual({
                kind: 'fiat',
                value: new Decimal(40),
            })
        })

        it('has no fiat total when every chain is on a test network', () => {
            mockHoldingSources.mockReturnValue([
                {
                    address: ALGO_ADDRESS,
                    scope: { chainId: 'algorand', networkId: 'testnet' },
                },
            ])

            const { result } = renderHook(() =>
                useAccountWithBalance(BOTH_CHAINS),
            )

            expect(result.current.crossChainTotal).toEqual({
                kind: 'testOnly',
            })
        })

        it('shows no value for an Algorand-only wallet on a test network, as for any other wallet', () => {
            mockBasis.current = 'native'
            mockHoldingSources.mockReturnValue([
                {
                    address: ALGO_ADDRESS,
                    scope: { chainId: 'algorand', networkId: 'testnet' },
                },
            ])

            const { result } = renderHook(() =>
                useAccountWithBalance(ALGO_ACCOUNT),
            )

            expect(result.current.crossChainTotal).toEqual({
                kind: 'testOnly',
            })
        })

        it("is unavailable when every one of the account's chains is switched off", () => {
            mockHoldingSources.mockReturnValue([])

            const { result } = renderHook(() =>
                useAccountWithBalance(BOTH_CHAINS),
            )

            expect(result.current.crossChainTotal).toEqual({
                kind: 'unavailable',
            })
        })

        it("still values the account when only its own chain's kill switch is on", () => {
            mockIsSwitchedOff.mockImplementation(
                (chainId: string) => chainId === 'algorand',
            )

            renderHook(() => useAccountWithBalance(BOTH_CHAINS))

            expect(mockTotalsQuery).toHaveBeenCalledWith(
                [BOTH_CHAINS],
                expect.anything(),
                true,
            )
        })
    })

    describe('singleNetworkChainId', () => {
        it('names the chain of a watch account that sits on one', () => {
            const { result } = renderHook(() =>
                useAccountWithBalance(ETH_ACCOUNT),
            )

            expect(result.current.singleNetworkChainId).toBe('ethereum')
        })

        it('names the chain on a single-chain wallet too', () => {
            const { result } = renderHook(() =>
                useAccountWithBalance(ALGO_ACCOUNT),
            )

            expect(result.current.singleNetworkChainId).toBe('algorand')
        })

        it('is unset for a watch account that spans chains', () => {
            const { result } = renderHook(() =>
                useAccountWithBalance(BOTH_CHAINS),
            )

            expect(result.current.singleNetworkChainId).toBeUndefined()
        })

        it('is unset for an account the wallet can sign for', () => {
            const local: WalletAccount = {
                ...ETH_ACCOUNT,
                custody: { kind: 'local', seed: null },
            }

            const { result } = renderHook(() => useAccountWithBalance(local))

            expect(result.current.singleNetworkChainId).toBeUndefined()
        })

        it('is unset on a row scoped to one chain', () => {
            const { result } = renderHook(() =>
                useAccountWithBalance(ETH_ACCOUNT, 'ethereum'),
            )

            expect(result.current.singleNetworkChainId).toBeUndefined()
        })

        it("is unset when the account's only chain is switched off", () => {
            mockHoldingSources.mockReturnValue([])

            const { result } = renderHook(() =>
                useAccountWithBalance(ETH_ACCOUNT),
            )

            expect(result.current.singleNetworkChainId).toBeUndefined()
        })
    })

    describe('jointParticipantCount', () => {
        const JOINT: WalletAccount = {
            ...ALGO_ACCOUNT,
            custody: { kind: 'multisig' },
        }

        it("counts the members of a joint account's multisig", () => {
            mockMultisigParameters.mockReturnValue({
                version: 1,
                threshold: 2,
                addresses: ['A', 'B', 'C'],
            })

            const { result } = renderHook(() => useAccountWithBalance(JOINT))

            expect(result.current.jointParticipantCount).toBe(3)
            expect(mockMultisigParameters).toHaveBeenCalledWith(
                JOINT,
                'algorand',
            )
        })

        it('is unset on a row scoped to one chain', () => {
            mockMultisigParameters.mockReturnValue({
                version: 1,
                threshold: 2,
                addresses: ['A', 'B', 'C'],
            })

            const { result } = renderHook(() =>
                useAccountWithBalance(JOINT, 'algorand'),
            )

            expect(result.current.jointParticipantCount).toBeUndefined()
        })

        it('is unset for an account with no multisig parameters', () => {
            const { result } = renderHook(() =>
                useAccountWithBalance(ALGO_ACCOUNT),
            )

            expect(result.current.jointParticipantCount).toBeUndefined()
        })
    })
})

describe('crossChainTotalOf', () => {
    const MAINNET_ALGO = {
        address: ALGO_ADDRESS,
        scope: { chainId: 'algorand', networkId: 'mainnet' },
    } as const
    const MAINNET_ETH = {
        address: ETH_ADDRESS,
        scope: { chainId: 'ethereum', networkId: 'mainnet' },
    } as const
    const doubled = (usd: Decimal | null | undefined) =>
        usd ? usd.times(2) : null
    const totals = (
        entries: [string, Parameters<typeof mockAccountValueTotals.set>[1]][],
    ) => new Map(entries) as never

    beforeAll(() => {
        registerEthereumChain()
    })

    it('is unavailable without a source', () => {
        expect(crossChainTotalOf([], totals([]), doubled)).toEqual({
            kind: 'unavailable',
        })
    })

    it('shows no value when every source is on a test network', () => {
        expect(
            crossChainTotalOf(
                [
                    {
                        address: ALGO_ADDRESS,
                        scope: { chainId: 'algorand', networkId: 'testnet' },
                    },
                ],
                totals([]),
                doubled,
            ),
        ).toEqual({ kind: 'testOnly' })
    })

    it('is still loading while any value is pending', () => {
        expect(
            crossChainTotalOf(
                [MAINNET_ALGO, MAINNET_ETH],
                totals([
                    [
                        `algorand|${ALGO_ADDRESS}`,
                        {
                            nativeValue: new Decimal(1),
                            fiatValue: new Decimal(1),
                        },
                    ],
                    [
                        `ethereum|${ETH_ADDRESS}`,
                        {
                            nativeValue: new Decimal(0),
                            fiatValue: new Decimal(0),
                            isPending: true,
                        },
                    ],
                ]),
                doubled,
            ),
        ).toEqual({ kind: 'fiat', value: undefined })
    })

    it('is unknown when any value is unpriced', () => {
        expect(
            crossChainTotalOf(
                [MAINNET_ALGO, MAINNET_ETH],
                totals([
                    [
                        `algorand|${ALGO_ADDRESS}`,
                        {
                            nativeValue: new Decimal(1),
                            fiatValue: new Decimal(1),
                        },
                    ],
                    [
                        `ethereum|${ETH_ADDRESS}`,
                        { nativeValue: new Decimal(1), fiatValue: null },
                    ],
                ]),
                doubled,
            ),
        ).toEqual({ kind: 'fiat', value: null })
    })

    it('sums the fiat values and converts the total', () => {
        expect(
            crossChainTotalOf(
                [MAINNET_ALGO, MAINNET_ETH],
                totals([
                    [
                        `algorand|${ALGO_ADDRESS}`,
                        {
                            nativeValue: new Decimal(1),
                            fiatValue: new Decimal(10),
                        },
                    ],
                    [
                        `ethereum|${ETH_ADDRESS}`,
                        {
                            nativeValue: new Decimal(1),
                            fiatValue: new Decimal(5),
                        },
                    ],
                ]),
                doubled,
            ),
        ).toEqual({ kind: 'fiat', value: new Decimal(30) })
    })
})
