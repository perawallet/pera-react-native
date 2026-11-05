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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { formatNumber } from '@perawallet/wallet-core-shared'
import {
    useAllAccounts,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    useSwapSourceCostQuery,
    type SwapQuote,
    type SwapSourceCost,
} from '@perawallet/wallet-core-swaps'
import type { SwapExecutionStatus } from '../../../hooks/useSwapExecution'
import { useSwapConfirmation } from '../useSwapConfirmation'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const { STYLES, mockUseAssetsQuery } = vi.hoisted(() => ({
    STYLES: {
        detailValue: { name: 'detailValue' },
        priceImpactLow: { name: 'priceImpactLow' },
        priceImpactMedium: { name: 'priceImpactMedium' },
        priceImpactHigh: { name: 'priceImpactHigh' },
    },
    mockUseAssetsQuery: vi.fn(),
}))

vi.mock('../styles', () => ({ useStyles: () => STYLES }))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: mockUseAssetsQuery,
    formatAssetAmount: (
        amount: { toString: () => string },
        options: { unitName?: string; decimals?: number },
    ) => `${amount.toString()} ${options.unitName ?? `d${options.decimals}`}`,
}))

const refOf = (assetId: string) => ({
    chainId: 'algorand' as const,
    networkId: 'mainnet' as const,
    assetId,
})
const ALGO = { assetId: '0', ref: refOf('0'), unitName: 'ALGO', decimals: 6 }
const USDC = {
    assetId: '31566704',
    ref: refOf('31566704'),
    unitName: 'USDC',
    decimals: 6,
}
const ASSETS: Record<string, { assetId: string; name: string }> = {
    '0': { assetId: '0', name: 'Algo' },
    '31566704': { assetId: '31566704', name: 'USD Coin' },
}

const SOURCE_COST: SwapSourceCost = {
    networkFee: new Decimal(10).pow(15),
    shortfall: null,
    needsSpendApproval: false,
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
}

const mockSourceCost = (sourceCost: SwapSourceCost | null) =>
    vi.mocked(useSwapSourceCostQuery).mockReturnValue({
        sourceCost,
        isLoading: false,
    })

const makeQuote = (overrides: Partial<SwapQuote> = {}): SwapQuote =>
    ({
        assetIn: ALGO,
        assetOut: USDC,
        amountIn: new Decimal(0),
        request: { slippage: null },
        fees: [],
        ...overrides,
    }) as unknown as SwapQuote

const renderConfirmation = (
    quote: SwapQuote,
    swapStatus: SwapExecutionStatus = 'idle',
) => renderHook(() => useSwapConfirmation({ scope: SCOPE, quote, swapStatus }))

const mockCurrency = (usdToPreferred: (usd: Decimal) => Decimal | null) =>
    vi.mocked(useCurrency).mockReturnValue({
        preferredCurrency: 'EUR',
        usdToPreferred,
    } as unknown as ReturnType<typeof useCurrency>)

describe('useSwapConfirmation', () => {
    beforeEach(() => {
        mockUseAssetsQuery.mockReset()
        mockUseAssetsQuery.mockImplementation((_scope, ids: string[]) => ({
            data: new Map(ids.map(id => [id, ASSETS[id]])),
        }))
        mockCurrency(usd => usd.mul(2))
        mockSourceCost(null)
        vi.mocked(formatNumber).mockReturnValue({
            sign: '',
            integer: '0',
            fraction: '.25',
        } as unknown as ReturnType<typeof formatNumber>)
    })

    describe('source cost', () => {
        it('shows no fee and blocks nothing with no estimate', () => {
            const { result } = renderConfirmation(makeQuote())

            expect(result.current).toMatchObject({
                networkFeeDisplay: null,
                needsSpendApproval: false,
                insufficientFeeMessage: null,
            })
        })

        it('shows the network fee in the native asset', () => {
            mockSourceCost(SOURCE_COST)

            const { result } = renderConfirmation(makeQuote())

            expect(result.current.networkFeeDisplay).toBe(
                `${SOURCE_COST.networkFee.toString()} ETH`,
            )
            expect(result.current.insufficientFeeMessage).toBeNull()
        })

        it('passes the spend approval on', () => {
            mockSourceCost({ ...SOURCE_COST, needsSpendApproval: true })

            const { result } = renderConfirmation(makeQuote())

            expect(result.current.needsSpendApproval).toBe(true)
        })

        it('names the shortfall so confirmation can stay off', () => {
            mockSourceCost({ ...SOURCE_COST, shortfall: new Decimal(1) })

            const { result } = renderConfirmation(makeQuote())

            expect(result.current.insufficientFeeMessage).toBe(
                'swap.quote.insufficient_network_fee',
            )
        })
    })

    describe('receiveTarget', () => {
        const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
        const RECEIVER = {
            id: 'receiver',
            chains: { ethereum: { address: '0xRECEIVER' } },
        } as unknown as WalletAccount

        const crossChainQuote = (destinationAddress: string) =>
            makeQuote({
                routeKind: 'cross-chain',
                request: {
                    slippage: null,
                    destinationAddress,
                    destinationAsset: { ...ETH_SCOPE, assetId: '0' },
                },
            } as unknown as Partial<SwapQuote>)

        it('names the account the payout goes to, on the receive chain', () => {
            vi.mocked(useAllAccounts).mockReturnValue([RECEIVER])

            const { result } = renderConfirmation(crossChainQuote('0xRECEIVER'))

            expect(result.current.receiveTarget).toEqual({
                account: RECEIVER,
                address: '0xRECEIVER',
                scope: ETH_SCOPE,
            })
        })

        it('still gives the address when no account holds it', () => {
            vi.mocked(useAllAccounts).mockReturnValue([RECEIVER])

            const { result } = renderConfirmation(crossChainQuote('0xOTHER'))

            expect(result.current.receiveTarget).toEqual({
                account: null,
                address: '0xOTHER',
                scope: ETH_SCOPE,
            })
        })

        it('is null on a same-chain swap', () => {
            const { result } = renderConfirmation(makeQuote())

            expect(result.current.receiveTarget).toBeNull()
        })
    })

    it('reads the receive asset on the chain it pays out on', () => {
        const ethRef = {
            chainId: 'ethereum',
            networkId: 'mainnet',
            assetId: '0',
        } as const

        renderConfirmation(
            makeQuote({
                assetOut: {
                    assetId: '0',
                    ref: ethRef,
                    unitName: 'ETH',
                    decimals: 18,
                } as unknown as SwapQuote['assetOut'],
            }),
        )

        expect(mockUseAssetsQuery).toHaveBeenCalledWith(
            { chainId: 'ethereum', networkId: 'mainnet' },
            ['0'],
        )
    })

    it('exposes the selected account', () => {
        const account = { id: 'acc-1' }
        vi.mocked(useSelectedAccount).mockReturnValueOnce(
            account as unknown as ReturnType<typeof useSelectedAccount>,
        )

        const { result } = renderConfirmation(makeQuote())

        expect(result.current.selectedAccount).toBe(account)
    })

    it('resolves both swap assets from the quote', () => {
        const { result } = renderConfirmation(makeQuote())

        expect(result.current.inAsset).toBe(ASSETS['0'])
        expect(result.current.outAsset).toBe(ASSETS['31566704'])
        expect(mockUseAssetsQuery).toHaveBeenCalledWith(SCOPE, ['0'])
        expect(mockUseAssetsQuery).toHaveBeenCalledWith(SCOPE, ['31566704'])
    })

    it('leaves the assets unresolved while the asset query has no data', () => {
        mockUseAssetsQuery.mockReturnValue({ data: undefined })

        const { result } = renderConfirmation(makeQuote())

        expect(result.current.inAsset).toBeUndefined()
        expect(result.current.outAsset).toBeUndefined()
    })

    it.each<[SwapExecutionStatus, boolean, boolean, boolean]>([
        ['idle', false, false, false],
        ['preparing', true, true, false],
        ['signing', true, false, true],
        ['submitting', true, false, true],
        ['updating-status', true, false, true],
        ['success', false, false, false],
        ['pending-cosign', false, false, false],
        ['verifying', false, false, false],
        ['error', false, false, false],
    ])(
        'derives processing state for %s',
        (status, isProcessing, isCancellable, isCommitted) => {
            const { result } = renderConfirmation(makeQuote(), status)

            expect(result.current).toMatchObject({
                isProcessing,
                isCancellable,
                isCommitted,
            })
        },
    )

    it('formats the pay and receive amounts with each asset decimals', () => {
        const quote = makeQuote({
            amountIn: new Decimal('1000000'),
            amountOut: new Decimal('250000'),
            assetOut: { ...USDC, decimals: 2 } as SwapQuote['assetOut'],
        })

        const { result } = renderConfirmation(quote)

        expect(result.current.payDisplay).toBe('1000000 d6')
        expect(result.current.receiveDisplay).toBe('250000 d2')
    })

    it('converts the USD values into the preferred currency', () => {
        const quote = makeQuote({
            amountInUsdValue: '10',
            amountOutUsdValue: '9.5',
        })

        const { result } = renderConfirmation(quote)

        expect(result.current.payFiatValue?.toString()).toBe('20')
        expect(result.current.receiveFiatValue?.toString()).toBe('19')
    })

    it('omits the fiat lines while the exchange rate is unresolved', () => {
        mockCurrency(() => null)
        const quote = makeQuote({
            amountInUsdValue: '10',
            amountOutUsdValue: '9.5',
        })

        const { result } = renderConfirmation(quote)

        expect(result.current.payFiatValue).toBeNull()
        expect(result.current.receiveFiatValue).toBeNull()
    })

    it('formats the rate from the quote amounts', () => {
        const quote = makeQuote({
            amountIn: new Decimal('4000000'),
            amountOut: new Decimal('1000000'),
        })

        const { result } = renderConfirmation(quote)

        expect(result.current.rateDisplay).toBe('1 ALGO ≈ 0.25 USDC')
        expect(vi.mocked(formatNumber).mock.calls[0][0]).toEqual(
            new Decimal('0.25'),
        )
    })

    it('shows no rate when an asset has unknown decimals', () => {
        const quote = makeQuote({
            amountIn: new Decimal('4000000'),
            amountOut: new Decimal('1000000'),
            assetOut: {
                ...USDC,
                decimals: undefined,
            } as unknown as SwapQuote['assetOut'],
        })

        const { result } = renderConfirmation(quote)

        expect(result.current.rateDisplay).toBe('-')
    })

    it('formats the minimum received in the out asset', () => {
        const quote = makeQuote({ minimumAmountOut: new Decimal('240000') })

        const { result } = renderConfirmation(quote)

        expect(result.current.minimumReceivedDisplay).toBe('240000 USDC')
    })

    it('formats the Pera fee in the asset it is charged in', () => {
        const quote = makeQuote({
            fees: [
                {
                    kind: 'pera',
                    asset: refOf('0'),
                    amount: new Decimal('1500'),
                    usdValue: null,
                },
            ],
        })

        const { result } = renderConfirmation(quote)

        expect(result.current.peraFeeDisplay).toBe('1500 ALGO')
    })

    it('shows the requested slippage as a percent', () => {
        const quote = makeQuote({
            request: { slippage: '1' } as SwapQuote['request'],
        })

        const { result } = renderConfirmation(quote)

        expect(result.current.slippageDisplay).toBe('1%')
    })

    it.each([
        ['0.5', false, '0.5%', 'priceImpactLow'],
        ['1', false, '1%', 'priceImpactMedium'],
        ['4.999', false, '5%', 'priceImpactMedium'],
        ['5', true, '5%', 'priceImpactHigh'],
        ['12.345', true, '12.35%', 'priceImpactHigh'],
    ] as const)(
        'grades a %s%% price impact',
        (impact, hasHighPriceImpact, priceImpactDisplay, style) => {
            const quote = makeQuote({ priceImpact: new Decimal(impact) })

            const { result } = renderConfirmation(quote)

            expect(result.current.hasHighPriceImpact).toBe(hasHighPriceImpact)
            expect(result.current.priceImpactDisplay).toBe(priceImpactDisplay)
            expect(result.current.priceImpactStyle).toBe(STYLES[style])
        },
    )
})
