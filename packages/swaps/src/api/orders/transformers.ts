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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { SwapHistoryItem, SwapOrder, SwapOrderStep } from '../../models'
import { transformSwapAsset } from '../assets/transformers'
import { toEpochMs } from '../quotes/transformers'
import { scopeOfRouterChain, type ResolveSwapAssetRef } from '../router-ids'
import {
    signTransactionsStepSchema,
    type CreateSwapOrderApiResponse,
    type SwapOrderItemApiResponse,
} from './schema'

const toStep = (
    step: CreateSwapOrderApiResponse['steps'][number],
): SwapOrderStep => {
    if (step.kind !== 'sign_transactions') {
        return { kind: 'unsupported', routerKind: step.kind }
    }
    // A malformed signing step throws rather than degrading to "unsupported".
    const parsed = signTransactionsStepSchema.parse(step)
    const scope = scopeOfRouterChain(parsed.chain)
    if (!scope) return { kind: 'unsupported', routerKind: step.kind }
    return {
        kind: 'sign-transactions',
        scope,
        purpose: parsed.purpose,
        transactions: parsed.transactions,
        presignedTransactions: parsed.signed_transactions ?? null,
    }
}

export const transformSwapOrder = (
    response: CreateSwapOrderApiResponse,
): SwapOrder => ({
    orderId: response.order_id,
    status: response.status,
    expiresAt: toEpochMs(response.expires_at),
    steps: response.steps.map(toStep),
})

const toDecimal = (value: Nullable<string>): Nullable<Decimal> =>
    value === null ? null : new Decimal(value)

export const transformSwapOrderItem = (
    item: SwapOrderItemApiResponse,
    resolve: ResolveSwapAssetRef,
): SwapHistoryItem => ({
    orderId: item.order_id,
    provider: item.provider,
    status: item.status,
    assetIn: item.source_asset
        ? transformSwapAsset(item.source_asset, resolve)
        : null,
    assetOut: item.destination_asset
        ? transformSwapAsset(item.destination_asset, resolve)
        : null,
    amountIn: toDecimal(item.source_amount),
    amountOut: toDecimal(
        item.destination_amount_received ?? item.destination_amount_expected,
    ),
    amountInUsdValue: item.source_amount_usd_value,
    amountOutUsdValue: item.destination_amount_usd_value,
    transactions: item.transactions.map(transaction => ({
        scope: scopeOfRouterChain(transaction.chain),
        txHash: transaction.tx_hash,
        role: transaction.role,
    })),
    createdAt: item.created_at,
    updatedAt: item.updated_at,
})
