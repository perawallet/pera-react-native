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
    logger,
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

const emptyPage = (): SwapHistoryPage => ({ results: [], next: null })

// Registering an account later makes it readable; the TTL lets it back in
// without waiting for a relaunch.
const REFUSAL_TTL_MS = 5 * 60 * 1000
const refusedAt = new Map<string, number>()

const deviceKey = (deviceId: string, value: string): string =>
    `${deviceId}|${value}`

const isRefused = (deviceId: string, account: string): boolean => {
    const key = deviceKey(deviceId, account)
    const at = refusedAt.get(key)
    if (at === undefined) return false
    if (Date.now() - at < REFUSAL_TTL_MS) return true
    refusedAt.delete(key)
    return false
}

// A cursor is valid only for the account list it was issued for, so a later
// page names that list whatever the refusal memo says by then.
const MAX_PINNED_CURSORS = 200
const cursorAccounts = new Map<string, string[]>()

const pinCursor = (
    deviceId: string,
    next: Nullable<string>,
    accounts: string[],
): void => {
    if (next === null) return
    cursorAccounts.set(deviceKey(deviceId, next), accounts)
    if (cursorAccounts.size > MAX_PINNED_CURSORS) {
        const oldest = cursorAccounts.keys().next().value
        if (oldest !== undefined) cursorAccounts.delete(oldest)
    }
}

type RefusalSearch = { refused: string[]; hasFailedProbe: boolean }

// The router refuses any read naming a refused account, so halving a refused
// list finds k refused accounts in about k·log2(n) probes instead of n.
const searchRefused = async (
    named: string[],
    isKnownRefused: boolean,
    probe: (accounts: string[]) => Promise<'readable' | 'refused' | 'failed'>,
): Promise<RefusalSearch> => {
    if (!isKnownRefused) {
        const outcome = await probe(named)
        if (outcome !== 'refused') {
            return { refused: [], hasFailedProbe: outcome === 'failed' }
        }
    }
    if (named.length === 1) return { refused: named, hasFailedProbe: false }

    const middle = Math.ceil(named.length / 2)
    const left = await searchRefused(named.slice(0, middle), false, probe)
    const isRightKnownRefused =
        left.refused.length === 0 && !left.hasFailedProbe
    const right = await searchRefused(
        named.slice(middle),
        isRightKnownRefused,
        probe,
    )
    return {
        refused: [...left.refused, ...right.refused],
        hasFailedProbe: left.hasFailedProbe || right.hasFailedProbe,
    }
}

/**
 * The router refuses a whole read that names an account not registered on the
 * device (EVM addresses register only through v4 registration). Those accounts
 * are found on a first page and dropped from later reads; each cursor keeps the
 * account list it was issued for.
 */
export const fetchDeviceSwapHistory = async (
    params: FetchSwapHistoryParams,
    scope: ChainScope,
    resolve?: ResolveSwapAssetRef,
): Promise<SwapHistoryPage> => {
    const { deviceId, cursor } = params
    const pinned = cursor
        ? cursorAccounts.get(deviceKey(deviceId, cursor))
        : undefined
    const accounts =
        pinned ??
        params.accounts.filter(account => !isRefused(deviceId, account))
    if (params.accounts.length > 0 && accounts.length === 0) return emptyPage()

    const read = async (named: string[]): Promise<SwapHistoryPage> => {
        const page = await fetchSwapHistory(
            { ...params, accounts: named },
            scope,
            resolve,
        )
        pinCursor(deviceId, page.next, named)
        return page
    }

    try {
        return await read(accounts)
    } catch (error) {
        if (isDeviceNotFoundError(error)) return emptyPage()
        if (
            !isAccountNotOnDeviceError(error) ||
            cursor ||
            accounts.length === 0
        ) {
            throw error
        }

        const { refused } = await searchRefused(accounts, true, async named => {
            try {
                await fetchSwapHistory(
                    { ...params, accounts: named, limit: 1 },
                    scope,
                    resolve,
                )
                return 'readable'
            } catch (probeError) {
                return isAccountNotOnDeviceError(probeError)
                    ? 'refused'
                    : 'failed'
            }
        })
        if (refused.length === 0) throw error

        // Remembered even when a sibling probe failed, so a retry starts from what was confirmed.
        refused.forEach(account =>
            refusedAt.set(deviceKey(deviceId, account), Date.now()),
        )
        const readable = accounts.filter(account => !refused.includes(account))
        logger.warn('Swap history: dropping accounts not on the device', {
            deviceId,
            dropped: refused.length,
            readable: readable.length,
        })
        return readable.length === 0 ? emptyPage() : read(readable)
    }
}
