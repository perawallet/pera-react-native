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
import { Decimal } from 'decimal.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    useAssetPricesQuery,
    useAssetsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    useEvmTransactionSimulationQuery,
    type EthereumTransactionView,
    type EvmTransactionSimulation,
} from '@perawallet/wallet-core-chain-ethereum'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import type { EthereumTransactionPresentation } from '../../../hooks/useEthereumTransactionPresentation'
import { useEthereumSimulationSection } from '../useEthereumSimulationSection'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainCapability: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-ethereum', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-ethereum')
    >()),
    useEvmTransactionSimulationQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    useSigningRequest: vi.fn(),
}))

const ETH = vi.hoisted(() => ({
    assetId: 'native',
    name: 'Ether',
    unitName: 'ETH',
    decimals: 18,
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    useNativeAsset: () => ETH,
    useAssetsQuery: vi.fn(),
    useAssetPricesQuery: vi.fn(),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SIGNER = '0x5A1E000000000000000000000000000000000001'
const ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const OTHER = '0x2222222222222222222222222222222222222222'
const COLLECTION = '0x1111111111111111111111111111111111111111'

const USDC_ASSET = {
    assetId: USDC,
    unitName: 'USDC',
    decimals: 6,
    creator: { address: '' },
    totalSupply: new Decimal(0),
} as PeraAsset

const PRICED: EthereumTransactionView = {
    kind: 'contract-call',
    from: SIGNER,
    to: ROUTER,
    value: new Decimal(0),
    data: '0x3593564c',
    nonce: 1,
    gas: 200_000n,
    fee: {
        maxFeePerGas: new Decimal(30),
        maxPriorityFeePerGas: new Decimal(2),
        maxFee: new Decimal(6_000_000),
    },
}

const presentationOf = (
    overrides: Partial<EthereumTransactionPresentation> = {},
    view: EthereumTransactionView = PRICED,
) =>
    ({
        view,
        scope: SCOPE,
        standardCall: null,
        contractAction: null,
        ...overrides,
    }) as EthereumTransactionPresentation

const answering = (
    answer: Partial<{
        data: EvmTransactionSimulation
        isPending: boolean
        isError: boolean
    }>,
) =>
    vi.mocked(useEvmTransactionSimulationQuery).mockReturnValue({
        data: undefined,
        isPending: false,
        isError: false,
        ...answer,
    })

const success = (
    overrides: Partial<
        Extract<EvmTransactionSimulation, { status: 'success' }>
    > = {},
): EvmTransactionSimulation => ({
    status: 'success',
    blockNumber: 1,
    assetChanges: [],
    approvalChanges: [],
    ...overrides,
})

const render = (presentation = presentationOf()) =>
    renderHook(() => useEthereumSimulationSection(presentation)).result.current

describe('useEthereumSimulationSection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useChainCapability).mockReturnValue(true)
        vi.mocked(useSigningRequest).mockReturnValue({
            currentRequest: { id: 'request-1', sourceType: 'walletconnect' },
        } as never)
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map([[USDC, USDC_ASSET]]),
            isPending: false,
        } as never)
        vi.mocked(useAssetPricesQuery).mockReturnValue({
            data: new Map([
                ['native', { assetId: 'native', usdPrice: new Decimal(2040) }],
                [USDC, { assetId: USDC, usdPrice: new Decimal(1) }],
            ]),
            isPending: false,
        } as never)
        answering({})
    })

    const isRequested = () =>
        vi.mocked(useEvmTransactionSimulationQuery).mock.lastCall?.[0].isEnabled

    describe('when it asks nothing', () => {
        it('is hidden, and asks nothing, while contractDecoding is off', () => {
            vi.mocked(useChainCapability).mockReturnValue(false)

            expect(render()).toEqual({ status: 'hidden' })
            expect(isRequested()).toBe(false)
        })

        it('is hidden, and asks nothing, for a call the wallet built itself', () => {
            vi.mocked(useSigningRequest).mockReturnValue({
                currentRequest: { id: 'request-1', sourceType: 'local' },
            } as never)

            expect(render()).toEqual({ status: 'hidden' })
            expect(isRequested()).toBe(false)
        })

        it('is hidden, and asks nothing, for a plain transfer', () => {
            const transfer = {
                ...PRICED,
                kind: 'transfer',
            } as EthereumTransactionView

            expect(render(presentationOf({}, transfer))).toEqual({
                status: 'hidden',
            })
            expect(isRequested()).toBe(false)
        })

        it('is hidden, and asks nothing, for a batch call not yet priced', () => {
            const preview = {
                kind: 'contract-call',
                from: SIGNER,
                to: ROUTER,
                value: new Decimal(0),
                data: '0x3593564c',
                isPreview: true,
            } as EthereumTransactionView

            expect(render(presentationOf({}, preview))).toEqual({
                status: 'hidden',
            })
            expect(isRequested()).toBe(false)
        })
    })

    describe('a call whose own gas estimate reverted', () => {
        const flagged = (revertedEstimate: { reason?: string } = {}) =>
            ({ ...PRICED, revertedEstimate }) as EthereumTransactionView

        it("is reverted with the node's reason, and asks the backend nothing", () => {
            answering({ data: success() })

            expect(
                render(presentationOf({}, flagged({ reason: 'EXPIRED' }))),
            ).toEqual({ status: 'reverted', reason: 'EXPIRED' })
            expect(isRequested()).toBe(false)
        })

        it('is reverted with no reason when the contract gave none', () => {
            expect(render(presentationOf({}, flagged()))).toEqual({
                status: 'reverted',
                reason: null,
            })
        })

        it('is reverted on a plain send, which is never simulated', () => {
            const transfer = {
                ...flagged(),
                kind: 'transfer',
            } as EthereumTransactionView

            expect(render(presentationOf({}, transfer))).toEqual({
                status: 'reverted',
                reason: null,
            })
        })

        it('is reverted when the simulation failed, even on a call the notice already covers', () => {
            answering({ isError: true })

            expect(render(presentationOf({}, flagged()))).toEqual({
                status: 'reverted',
                reason: null,
            })
        })

        it('is reverted when the simulation says the call succeeds', () => {
            answering({ data: success() })

            expect(render(presentationOf({}, flagged()))).toMatchObject({
                status: 'reverted',
            })
        })

        it('is reverted with contractDecoding off, since the node refused it', () => {
            vi.mocked(useChainCapability).mockReturnValue(false)

            expect(render(presentationOf({}, flagged()))).toMatchObject({
                status: 'reverted',
            })
        })
    })

    it('is loading while the prediction is pending', () => {
        answering({ isPending: true })

        expect(render()).toEqual({ status: 'loading' })
        expect(isRequested()).toBe(true)
    })

    it('is loading while the tokens it moves are still being read', () => {
        answering({ data: success() })
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map(),
            isPending: true,
        } as never)

        expect(render()).toEqual({ status: 'loading' })
    })

    it('splits a swap into what leaves and what arrives, each with its price', () => {
        answering({
            data: success({
                assetChanges: [
                    {
                        assetId: 'native',
                        standard: 'native',
                        amount: new Decimal('-1000000000000000'),
                    },
                    {
                        assetId: USDC,
                        standard: 'erc20',
                        amount: new Decimal('2282960'),
                    },
                ],
            }),
        })

        const state = render()

        expect(state.status).toBe('success')
        if (state.status !== 'success') return
        expect(state.spend).toHaveLength(1)
        expect(state.spend[0]).toMatchObject({
            assetId: 'native',
            amount: new Decimal('0.001'),
            usdPrice: new Decimal(2040),
        })
        expect(state.receive).toHaveLength(1)
        expect(state.receive[0]).toMatchObject({
            assetId: USDC,
            amount: new Decimal('2.28296'),
            usdPrice: new Decimal(1),
        })
        expect(state.approvals).toEqual([])
    })

    it('leaves out a delta of zero, which moves nothing', () => {
        answering({
            data: success({
                assetChanges: [
                    {
                        assetId: 'native',
                        standard: 'native',
                        amount: new Decimal(0),
                    },
                    {
                        assetId: USDC,
                        standard: 'erc20',
                        amount: new Decimal('2282960'),
                    },
                ],
            }),
        })

        const state = render()

        expect(state.status).toBe('success')
        if (state.status !== 'success') return
        expect(state.spend).toEqual([])
        expect(state.receive.map(item => item.assetId)).toEqual([USDC])
    })

    it('reads each kind of approval, naming a known spender', () => {
        answering({
            data: success({
                approvalChanges: [
                    {
                        contract: USDC,
                        spender: PERMIT2,
                        knownSpender: { name: 'Permit2' },
                        isCollectionWide: false,
                    },
                    {
                        contract: USDC,
                        spender: OTHER,
                        isCollectionWide: false,
                        amount: new Decimal('5000000'),
                    },
                    {
                        contract: USDC,
                        spender: OTHER,
                        isCollectionWide: false,
                        amount: new Decimal(0),
                    },
                    {
                        contract: COLLECTION,
                        spender: OTHER,
                        isCollectionWide: false,
                        tokenId: '12',
                        amount: new Decimal(1),
                    },
                    {
                        contract: COLLECTION,
                        spender: OTHER,
                        isCollectionWide: true,
                    },
                ],
            }),
        })

        const state = render()

        expect(state.status).toBe('success')
        if (state.status !== 'success') return
        expect(state.approvals.map(a => a.grant)).toEqual([
            { kind: 'unlimited' },
            { kind: 'amount', amount: new Decimal(5), isBaseUnits: false },
            { kind: 'revoke' },
            { kind: 'token', tokenId: '12' },
            { kind: 'unlimited' },
        ])
        expect(state.approvals.map(a => a.spenderName)).toEqual([
            'Permit2',
            undefined,
            undefined,
            undefined,
            undefined,
        ])
        expect(state.approvals[0].asset).toBe(USDC_ASSET)
        expect(state.approvals[3].asset).toBeNull()
        expect(state.approvals[4].isCollectionWide).toBe(true)
    })

    describe('an approval the call decodes to', () => {
        const decoded = presentationOf({
            standardCall: {
                kind: 'token-approval',
                contract: USDC,
                spender: PERMIT2,
            } as never,
        })
        const permit2Approval = {
            contract: USDC,
            spender: PERMIT2,
            isCollectionWide: false,
        } as const

        it('is hidden when it is the only change, since the call review already shows it', () => {
            answering({ data: success({ approvalChanges: [permit2Approval] }) })

            expect(render(decoded)).toEqual({ status: 'hidden' })
        })

        it('is left out of the list while the rest of the changes still show', () => {
            answering({
                data: success({
                    assetChanges: [
                        {
                            assetId: USDC,
                            standard: 'erc20',
                            amount: new Decimal('-5000000'),
                        },
                    ],
                    approvalChanges: [
                        permit2Approval,
                        {
                            contract: USDC,
                            spender: OTHER,
                            isCollectionWide: false,
                        },
                    ],
                }),
            })

            const state = render(decoded)

            expect(state.status).toBe('success')
            if (state.status !== 'success') return
            expect(state.spend).toHaveLength(1)
            expect(state.approvals.map(a => a.spender)).toEqual([OTHER])
        })

        it('matches a collection-wide grant by its operator', () => {
            answering({
                data: success({
                    approvalChanges: [
                        {
                            contract: COLLECTION,
                            spender: OTHER,
                            isCollectionWide: true,
                        },
                    ],
                }),
            })

            expect(
                render(
                    presentationOf({
                        standardCall: {
                            kind: 'collection-approval',
                            contract: COLLECTION,
                            operator: OTHER.toLowerCase(),
                            isApproved: true,
                        } as never,
                    }),
                ),
            ).toEqual({ status: 'hidden' })
        })

        it('still says nothing changes when the simulation found no approval at all', () => {
            answering({ data: success() })

            expect(render(decoded)).toMatchObject({
                status: 'success',
                approvals: [],
            })
        })
    })

    it('shows a limited approval in base units while its token is unread', () => {
        answering({
            data: success({
                approvalChanges: [
                    {
                        contract: USDC,
                        spender: OTHER,
                        isCollectionWide: false,
                        amount: new Decimal('5000000'),
                    },
                ],
            }),
        })
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map(),
            isPending: false,
        } as never)

        const state = render()

        expect(state.status === 'success' && state.approvals[0].grant).toEqual({
            kind: 'amount',
            amount: new Decimal('5000000'),
            isBaseUnits: true,
        })
    })

    it('is a success with nothing in it for a call predicted to change nothing', () => {
        answering({ data: success() })

        expect(render()).toEqual({
            status: 'success',
            spend: [],
            receive: [],
            approvals: [],
        })
    })

    it("carries the contract's own reason for a predicted revert", () => {
        answering({
            data: { status: 'reverted', revertReason: 'STF' },
        })

        expect(render()).toEqual({ status: 'reverted', reason: 'STF' })
    })

    describe('when no prediction could be made', () => {
        const explained = presentationOf({
            standardCall: { kind: 'token-approval' } as never,
        })

        it.each([
            [
                'an unavailable answer',
                { data: { status: 'unavailable' as const } },
            ],
            ['a failed request', { isError: true }],
        ])('says it could not simulate, after %s', (_name, answer) => {
            answering(answer)

            expect(render(explained)).toEqual({ status: 'unavailable' })
        })

        it('stays hidden when the unchecked-call notice already covers an unexplained call', () => {
            answering({ isError: true })

            expect(render(presentationOf())).toEqual({ status: 'hidden' })
        })
    })
})
