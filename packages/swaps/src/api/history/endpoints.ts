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

// Registering an account later makes it readable; the TTL lets it back in
// without waiting for a relaunch.
const REFUSAL_TTL_MS = 5 * 60 * 1000
const refusedAt = new Map<string, number>()

const refusalKey = (deviceId: string, account: string): string =>
    `${deviceId}|${account}`

const isRefused = (deviceId: string, account: string): boolean => {
    const key = refusalKey(deviceId, account)
    const at = refusedAt.get(key)
    if (at === undefined) return false
    if (Date.now() - at < REFUSAL_TTL_MS) return true
    refusedAt.delete(key)
    return false
}

/**
 * The router refuses a whole read that names an account not registered on the
 * device (EVM addresses register only through v4 registration). Those accounts
 * are found once and dropped from later reads so the cursor stays valid.
 */
export const fetchDeviceSwapHistory = async (
    params: FetchSwapHistoryParams,
    scope: ChainScope,
    resolve?: ResolveSwapAssetRef,
): Promise<SwapHistoryPage> => {
    const { deviceId } = params
    const accounts = params.accounts.filter(
        account => !isRefused(deviceId, account),
    )
    if (params.accounts.length > 0 && accounts.length === 0) return EMPTY_PAGE

    const read = (named: string[]) =>
        fetchSwapHistory({ ...params, accounts: named }, scope, resolve)

    try {
        return await read(accounts)
    } catch (error) {
        if (isDeviceNotFoundError(error)) return EMPTY_PAGE
        if (
            !isAccountNotOnDeviceError(error) ||
            params.cursor ||
            accounts.length === 0
        ) {
            throw error
        }

        const refuse = (account: string) =>
            refusedAt.set(refusalKey(deviceId, account), Date.now())
        if (accounts.length === 1) {
            refuse(accounts[0])
            return EMPTY_PAGE
        }

        const probes = await Promise.all(
            accounts.map(async account => {
                try {
                    await fetchSwapHistory(
                        { ...params, accounts: [account], limit: 1 },
                        scope,
                        resolve,
                    )
                    return true
                } catch (probeError) {
                    if (isAccountNotOnDeviceError(probeError)) return false
                    throw probeError
                }
            }),
        )
        const readable = accounts.filter((_, index) => probes[index])
        if (readable.length === accounts.length) throw error

        accounts.filter((_, index) => !probes[index]).forEach(refuse)
        return readable.length === 0 ? EMPTY_PAGE : read(readable)
    }
}
