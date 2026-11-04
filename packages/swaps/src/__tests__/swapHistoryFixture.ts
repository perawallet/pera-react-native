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
import type { SwapAsset, SwapHistoryItem } from '../models'

const asset = (assetId: string): SwapAsset => ({
    ref: { chainId: 'algorand', networkId: 'mainnet', assetId },
    assetId,
    unitName: `A${assetId}`,
    decimals: 6,
    verificationTier: 'verified',
    crossChainAssetGroup: null,
})

export const makeSwapHistoryItem = (
    overrides: Partial<SwapHistoryItem> = {},
): SwapHistoryItem => ({
    orderId: 'order-1',
    provider: 'provider-x',
    status: 'completed',
    assetIn: asset('native'),
    assetOut: asset('31566704'),
    amountIn: new Decimal('1000000'),
    amountOut: new Decimal('2000000'),
    amountInUsdValue: '1.00',
    amountOutUsdValue: '2.00',
    transactions: [],
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:01:00Z',
    ...overrides,
})
