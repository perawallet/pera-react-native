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

import type {
    ChainScope,
    WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import { deploymentOf } from '@perawallet/wallet-core-config'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { routerAccountIdOrNull } from '../api/router-ids'
import type { SwapAccountAddress, SwapHistoryItem } from '../models'

// The accounts travel in the URL, one CAIP-10 id each; a wallet with many
// accounts on several chains would outgrow it in a single request.
export const ACCOUNTS_PER_REQUEST = 20

export type SwapHistoryBatch = {
    /** The deployment's own device id and router scope serve every account in it. */
    scope: ChainScope
    deployment: WalletMode
    accounts: (SwapAccountAddress & { routerId: string })[]
}

/** One batch's read: the rows it returned and where its next page starts. */
export type SwapHistoryBatchPage = {
    /** The router ids `next` is bound to; the router refuses a cursor sent with other accounts. */
    accounts: string[]
    results: SwapHistoryItem[]
    /** Null once the batch has no older page. */
    next: Nullable<string>
    /** `createdAt` of the last row the router returned, before any filtering; null for an empty page. */
    oldestCreatedAt: Nullable<string>
    /** Set when the read of this batch failed, so its empty page doesn't pass for "no swaps". */
    failed?: boolean
}

export type SwapHistoryCursor = {
    accounts: string[]
    /** Null for a batch with nothing left to read. */
    cursor: Nullable<string>
}

const chunksOf = <T>(items: readonly T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
        items.slice(index * size, (index + 1) * size),
    )

export const swapHistoryBatchesOf = (
    accounts: readonly SwapAccountAddress[],
): SwapHistoryBatch[] => {
    const byDeployment = new Map<WalletMode, SwapHistoryBatch['accounts']>()
    for (const account of accounts) {
        // An account on a network the router has no id for, such as a custom
        // node, or with no Pera deployment, can't have swapped there.
        const routerId = routerAccountIdOrNull(account.scope, account.address)
        const deployment = deploymentOf(account.scope)
        if (!routerId || !deployment) continue
        const group = byDeployment.get(deployment) ?? []
        group.push({ ...account, routerId })
        byDeployment.set(deployment, group)
    }
    return [...byDeployment].flatMap(([deployment, group]) =>
        chunksOf(group, ACCOUNTS_PER_REQUEST).map(chunk => ({
            scope: chunk[0].scope,
            deployment,
            accounts: chunk,
        })),
    )
}

/** Undefined when every batch is exhausted, else one cursor per batch in order. */
export const nextSwapHistoryCursors = (
    page: SwapHistoryBatchPage[],
): Optional<SwapHistoryCursor[]> =>
    page.every(batch => batch.next === null)
        ? undefined
        : page.map(({ accounts, next }) => ({ accounts, cursor: next }))

const timeOf = (createdAt: string): number => Date.parse(createdAt)

/**
 * Every loaded row, once each, newest first. A batch that still has older
 * pages may hold a row newer than anything past its oldest loaded one, so
 * rows older than the newest such point wait until that batch reaches them.
 */
export const mergeSwapHistoryPages = (
    pages: SwapHistoryBatchPage[][],
): SwapHistoryItem[] => {
    const lastPage = pages.at(-1) ?? []
    const frontier = lastPage.reduce((newest, batch, index) => {
        if (batch.next === null) return newest
        const oldest = pages
            .map(page => page[index]?.oldestCreatedAt ?? null)
            .filter((createdAt): createdAt is string => createdAt !== null)
            .at(-1)
        return oldest === undefined ? newest : Math.max(newest, timeOf(oldest))
    }, Number.NEGATIVE_INFINITY)

    const byOrderId = new Map<string, SwapHistoryItem>()
    for (const item of pages.flatMap(page =>
        page.flatMap(batch => batch.results),
    )) {
        byOrderId.set(item.orderId, item)
    }
    return [...byOrderId.values()]
        .filter(item => timeOf(item.createdAt) >= frontier)
        .sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt))
}
