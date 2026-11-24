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

import { z } from 'zod'
import { Decimal } from 'decimal.js'
import {
    i18nKey,
    type AssetRef,
    type BalanceChange,
    type TransactionNotice,
    type TransactionRecord,
    type TransactionSummary,
    type TransactionSwapLeg,
} from '@perawallet/wallet-core-chain-contract'
import type { Maybe, Optional } from '@perawallet/wallet-core-shared'

const swapAssetSchema = z.object({
    /** CAIP-19. */
    asset_id: z.string(),
    unit_name: z.string().nullish(),
    fraction_decimals: z.number().int().min(0).nullish(),
})

const baseUnits = z.string().regex(/^\d+$/).nullable()

/** A history row's `swap`: the backend's order item, only the fields a row reads. */
export const swapLegResponseSchema = z.object({
    role: z.string(),
    order: z.object({
        order_id: z.string(),
        provider: z.string().nullable(),
        provider_display_name: z.string().nullish(),
        status: z.string(),
        source_asset: swapAssetSchema.nullable(),
        destination_asset: swapAssetSchema.nullable(),
        source_amount: baseUnits,
        destination_amount_expected: baseUnits,
        destination_amount_received: baseUnits.optional(),
    }),
})
export type SwapLegResponse = z.infer<typeof swapLegResponseSchema>

/** The row's `swap` as the backend sent it; undefined when absent or unreadable, which drops the swap, never the row. */
export const readSwapLeg = (value: unknown): Optional<SwapLegResponse> => {
    if (value === undefined || value === null) return undefined
    const parsed = swapLegResponseSchema.safeParse(value)
    return parsed.success ? parsed.data : undefined
}

// The roles that move the user's funds; an approval or opt-in stays what it is.
const ROLE: Readonly<Record<string, TransactionSwapLeg['role']>> = {
    swap: 'source',
    deposit: 'source',
    payout: 'payout',
    refund: 'refund',
}

export const swapLegOf = (
    leg: SwapLegResponse,
): Optional<TransactionSwapLeg> => {
    const role = ROLE[leg.role]
    return role && { orderId: leg.order.order_id, role }
}

const IN_PROGRESS: TransactionNotice = {
    kind: 'warning',
    title: { key: i18nKey('swap.history.list.item.status.in_progress') },
}
const FAILED: TransactionNotice = {
    kind: 'error',
    title: { key: i18nKey('swap.history.list.item.status.failed') },
}
const NOTICE_BY_STATUS: Readonly<Record<string, TransactionNotice>> = {
    pending: IN_PROGRESS,
    in_progress: IN_PROGRESS,
    failed: FAILED,
    expired: FAILED,
    cancelled: FAILED,
    refunded: {
        kind: 'warning',
        title: { key: i18nKey('swap.history.list.item.status.refunded') },
    },
}

/** The wallet's ref for a router asset id (CAIP-19) on the row's own chain and network; undefined for any other. */
export type ResolveSwapAssetRef = (routerAssetId: string) => Optional<AssetRef>

const changeOf = (
    asset: SwapLegResponse['order']['source_asset'],
    baseUnits: Maybe<string>,
    sign: 1 | -1,
    resolve: ResolveSwapAssetRef,
): BalanceChange[] => {
    const assetRef = asset && resolve(asset.asset_id)
    if (!asset || !assetRef || !baseUnits) return []
    const value = new Decimal(baseUnits)
    return [
        {
            assetRef,
            value: sign === 1 ? value : value.negated(),
            display: {
                symbol: asset.unit_name ?? '',
                decimals: asset.fraction_decimals ?? 0,
            },
        },
    ]
}

/**
 * A swap leg's row. The source leg stands for the whole swap: what the order
 * paid and, once completed, what it paid out when that is on the same chain. A
 * payout or refund keeps the amount its chain reported. The order's status is
 * the row's notice, unless the transaction itself failed on chain.
 */
export const summarizeSwapLeg = (
    leg: SwapLegResponse,
    chainSummary: TransactionSummary,
    chainStatus: Optional<TransactionRecord['status']>,
    resolve: ResolveSwapAssetRef,
): TransactionSummary => {
    const swapLeg = swapLegOf(leg)
    if (!swapLeg) return chainSummary
    const { order } = leg
    const from = order.source_asset?.unit_name
    const to = order.destination_asset?.unit_name
    const providerName = order.provider_display_name ?? order.provider
    const notice =
        chainStatus === 'failed' || chainStatus === 'replaced'
            ? chainSummary.notice
            : NOTICE_BY_STATUS[order.status]
    const amounts: Partial<TransactionSummary> =
        swapLeg.role === 'source'
            ? {
                  direction: 'none',
                  balanceChanges: [
                      ...changeOf(
                          order.source_asset,
                          order.source_amount,
                          -1,
                          resolve,
                      ),
                      // Until the payout lands the expected amount is only the quote's.
                      ...(order.status === 'completed'
                          ? changeOf(
                                order.destination_asset,
                                order.destination_amount_received ??
                                    order.destination_amount_expected,
                                1,
                                resolve,
                            )
                          : []),
                  ],
              }
            : {
                  direction: chainSummary.direction,
                  ...(chainSummary.amount && { amount: chainSummary.amount }),
                  ...(chainSummary.balanceChanges && {
                      balanceChanges: chainSummary.balanceChanges,
                  }),
              }
    return {
        kind: 'swap',
        title:
            from && to
                ? {
                      key: i18nKey('transactions.list_item.swap_pair'),
                      params: { from, to },
                  }
                : { key: i18nKey('transactions.list_item.swap') },
        icon: 'swap',
        direction: 'none',
        ...amounts,
        ...(providerName && {
            subtitle: {
                key: i18nKey('transactions.list_item.interpreted_title'),
                params: { title: providerName },
            },
            subtitleEllipsis: 'tail' as const,
        }),
        ...(notice && { notice }),
    }
}

/**
 * Drops a swap payout whose order's source leg is in the same list: that row
 * already shows the whole swap. Where the source isn't listed, as in the payout
 * asset's own history, the payout row stands for the swap.
 */
export const withoutListedSwapPayouts = (
    records: TransactionRecord[],
): TransactionRecord[] => {
    const listedOrders = new Set(
        records.flatMap(({ swapLeg }) =>
            swapLeg?.role === 'source' ? [swapLeg.orderId] : [],
        ),
    )
    if (listedOrders.size === 0) return records
    return records.filter(
        ({ swapLeg }) =>
            swapLeg?.role !== 'payout' || !listedOrders.has(swapLeg.orderId),
    )
}
