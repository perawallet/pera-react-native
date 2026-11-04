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

import { Decimal } from 'decimal.js'
import type { SwapAsset, SwapQuote, SwapQuoteRequest } from '../models'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const asset = (assetId: string, unitName: string): SwapAsset => ({
    ref: { ...SCOPE, assetId },
    assetId,
    name: unitName,
    unitName,
    decimals: 6,
    verificationTier: 'verified',
    crossChainAssetGroup: null,
})

type SwapQuoteOverrides = Omit<
    Partial<SwapQuote>,
    'assetIn' | 'assetOut' | 'request'
> & {
    assetIn?: Partial<SwapAsset>
    assetOut?: Partial<SwapAsset>
    request?: Partial<SwapQuoteRequest>
}

export const makeSwapQuote = ({
    assetIn,
    assetOut,
    request,
    ...overrides
}: SwapQuoteOverrides = {}): SwapQuote => ({
    quoteId: 'quote-1',
    request: {
        sourceAsset: { ...SCOPE, assetId: 'native' },
        destinationAsset: { ...SCOPE, assetId: '31566704' },
        sourceAmount: new Decimal('5000000'),
        sourceAddress: 'SENDER',
        destinationAddress: 'SENDER',
        slippage: '0.5',
        ...request,
    },
    provider: 'provider-x',
    routeKind: 'single-chain',
    assetIn: { ...asset('native', 'NAT'), ...assetIn },
    assetOut: { ...asset('31566704', 'USDC'), ...assetOut },
    amountIn: new Decimal('5000000'),
    amountOut: new Decimal('1200000'),
    minimumAmountOut: new Decimal('1194000'),
    amountInUsdValue: '1.10',
    amountOutUsdValue: '1.09',
    fees: [],
    priceImpact: null,
    expiresAt: null,
    fetchedAt: Date.now(),
    ...overrides,
})
