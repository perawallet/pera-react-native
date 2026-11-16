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
import {
    isPeraNetworkError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { SwapHistoryItem } from '../../models'
import { transformSwapOrderItem } from '../orders/transformers'
import { cursorOf, routerRequest } from '../router-request'
import { swapAssetRefOf, type ResolveSwapAssetRef } from '../router-ids'
import { swapHistoryResponseSchema } from './schema'

export type FetchSwapHistoryParams = {
    deviceId: string
    /** Router account ids (CAIP-10) to narrow to; empty for every account on the device. */
    accounts: string[]
    cursor?: string
    limit?: number
}

export type SwapHistoryPage = {
    results: SwapHistoryItem[]
    next: Nullable<string>
}

/** Every route and status, newest first; the router has no status filter. */
export const fetchSwapHistory = async (
    { deviceId, accounts, cursor, limit }: FetchSwapHistoryParams,
    scope: ChainScope,
    resolve: ResolveSwapAssetRef = swapAssetRefOf,
): Promise<SwapHistoryPage> => {
    const data = await routerRequest({
        scope,
        method: 'GET',
        path: 'history/',
        params: {
            device_id: deviceId,
            ...(accounts.length > 0 ? { accounts: accounts.join(',') } : {}),
            ...(cursor ? { cursor } : {}),
            ...(limit !== undefined ? { limit } : {}),
        },
    })
    const parsed = swapHistoryResponseSchema.parse(data)
    return {
        results: parsed.results.map(item =>
            transformSwapOrderItem(item, resolve),
        ),
        next: cursorOf(parsed.next),
    }
}

const isAccountNotOnDeviceError = (error: unknown): boolean =>
    isPeraNetworkError(error) &&
    error.status === 422 &&
    error.backendCode === 'account_not_on_device'

const isDeviceNotFoundError = (error: unknown): boolean =>
    isPeraNetworkError(error) &&
    error.status === 404 &&
    error.backendCode === 'device_not_found'

const EMPTY_PAGE: SwapHistoryPage = { results: [], next: null }

/**
 * `fetchSwapHistory` limited to the swaps this device can read. The router
 * refuses a whole read when one named account isn't registered on the device
 * (EVM addresses only register through v4 device registration), so a read that
 * hits that is redone per account and the unregistered ones are dropped. A
 * refused later page rejects: restarting would repeat rows already shown.
 */
export const fetchDeviceSwapHistory = async (
    params: FetchSwapHistoryParams,
    scope: ChainScope,
    resolve?: ResolveSwapAssetRef,
): Promise<SwapHistoryPage> => {
    try {
        return await fetchSwapHistory(params, scope, resolve)
    } catch (error) {
        if (isDeviceNotFoundError(error)) return EMPTY_PAGE
        if (!isAccountNotOnDeviceError(error) || params.cursor) throw error
        if (params.accounts.length <= 1) return EMPTY_PAGE

        const pages = await Promise.all(
            params.accounts.map(async account => {
                try {
                    return await fetchSwapHistory(
                        { ...params, accounts: [account], cursor: undefined },
                        scope,
                        resolve,
                    )
                } catch (accountError) {
                    if (isAccountNotOnDeviceError(accountError))
                        return EMPTY_PAGE
                    throw accountError
                }
            }),
        )

        const byOrderId = new Map<string, SwapHistoryItem>()
        for (const page of pages) {
            for (const item of page.results) byOrderId.set(item.orderId, item)
        }
        const merged = [...byOrderId.values()].sort(
            (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        )
        return {
            results:
                params.limit === undefined
                    ? merged
                    : merged.slice(0, params.limit),
            next: null,
        }
    }
}
