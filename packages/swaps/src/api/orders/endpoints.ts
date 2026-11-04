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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { SwapHistoryItem, SwapOrder, SwapOrderReport } from '../../models'
import { routerRequest } from '../router-request'
import {
    routerChainIdOf,
    swapAssetRefOf,
    type ResolveSwapAssetRef,
} from '../router-ids'
import {
    createSwapOrderResponseSchema,
    swapOrderItemSchema,
    type ReportSwapOrderRequest,
} from './schema'
import { transformSwapOrder, transformSwapOrderItem } from './transformers'

/** The router reads the accounts and amounts from the stored quote, never from this call. */
export const createSwapOrder = async (
    quoteId: string,
    scope: ChainScope,
): Promise<SwapOrder> => {
    const data = await routerRequest({
        scope,
        method: 'POST',
        path: 'orders/',
        data: { quote_id: quoteId },
    })
    return transformSwapOrder(createSwapOrderResponseSchema.parse(data))
}

export const toReportSwapOrderRequest = (
    report: SwapOrderReport,
): ReportSwapOrderRequest =>
    report.status === 'cancelled'
        ? { status: 'cancelled' }
        : {
              status: 'sent',
              transactions: report.transactions.map(transaction => ({
                  chain: routerChainIdOf(transaction.scope),
                  tx_hash: transaction.txHash,
                  purpose: transaction.purpose,
              })),
          }

export const reportSwapOrder = async (
    orderId: string,
    report: SwapOrderReport,
    scope: ChainScope,
    resolve: ResolveSwapAssetRef = swapAssetRefOf,
): Promise<SwapHistoryItem> => {
    const data = await routerRequest({
        scope,
        method: 'PATCH',
        path: `orders/${encodeURIComponent(orderId)}/`,
        data: toReportSwapOrderRequest(report),
    })
    return transformSwapOrderItem(swapOrderItemSchema.parse(data), resolve)
}

export const fetchSwapOrder = async (
    orderId: string,
    scope: ChainScope,
    resolve: ResolveSwapAssetRef = swapAssetRefOf,
): Promise<SwapHistoryItem> => {
    const data = await routerRequest({
        scope,
        method: 'GET',
        path: `orders/${encodeURIComponent(orderId)}/`,
    })
    return transformSwapOrderItem(swapOrderItemSchema.parse(data), resolve)
}
