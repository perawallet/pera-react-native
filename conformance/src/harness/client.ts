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

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'

import type { AccountInformation } from '@perawallet/wallet-core-blockchain/models'
import { createTimeoutBoundedAlgorandClient } from '@perawallet/wallet-core-blockchain/utils/createAlgorandClient'
import { fetchOnChainAccountInformation } from '@perawallet/wallet-core-accounts/hooks/endpoints'
import { mapOnChainAccountInformation } from '@perawallet/wallet-core-accounts/hooks/mappers'

import {
    LOCALNET_ALGOD_URL,
    LOCALNET_INDEXER_URL,
    LOCALNET_TOKEN,
} from './localnet'

let client: AlgorandClient | undefined

/**
 * The app's own client factory pointed at LocalNet, so the suites exercise the
 * same `TimeoutHttpClient` transport and error transformer the wallet ships.
 * Memoised: every suite calls this (directly or via `balanceOf`/`authAddrOf`)
 * on nearly every assertion, and a fresh client per call was otherwise the
 * common case rather than the exception.
 *
 * Side effect: a shared client also activates AlgoKit's own suggested-params
 * cache (`_cachedSuggestedParamsTimeout`, 3s), which the old fresh-client-per-call
 * pattern defeated — builds within a 3s window can now share `firstValid`/
 * `lastValid`. Judged benign for this suite: the validity window is 1000
 * rounds, the expired-txn case reads `lastRound` from an uncached
 * `algod.status()` call, and every suite uses deliberately distinct amounts
 * rather than relying on txn identity.
 */
export const getConformanceClient = (): AlgorandClient => {
    client ??= createTimeoutBoundedAlgorandClient({
        algodUrl: LOCALNET_ALGOD_URL,
        algodToken: LOCALNET_TOKEN,
        indexerUrl: LOCALNET_INDEXER_URL,
        indexerToken: '',
    })
    return client
}

/**
 * The account as the app models it, read fresh from the node through the
 * app's own fetch + transform pair. Every balance and auth-addr assertion in
 * the suite reads through this, so a transformer that drops or mistypes a
 * field fails the suite rather than being quietly bypassed.
 */
export const accountInformationOf = async (
    address: string,
): Promise<AccountInformation> =>
    mapOnChainAccountInformation(
        await fetchOnChainAccountInformation(getConformanceClient(), address),
    )

/** The sender's ALGO balance, read fresh from the node. */
export const balanceOf = async (address: string): Promise<bigint> =>
    (await accountInformationOf(address)).amount

/** The account's `auth-addr`, or `undefined` if it is not rekeyed. */
export const authAddrOf = async (
    address: string,
): Promise<string | undefined> =>
    (await accountInformationOf(address)).authAddress

/**
 * The raw indexer JSON for an account's transactions — hyphenated keys, no
 * algosdk model mapping — which is exactly the shape the app's own
 * `transformIndexerTransactions` parses. Going over plain `fetch` rather than
 * the app's `queryClient` keeps the transport out of the picture: this suite
 * is pinning the transformers against real indexer output, not the HTTP layer
 * (`chokepoint.spec.ts` covers that).
 *
 * The indexer trails algod by a round or two, so this polls until `txId` is
 * present rather than assuming it already is.
 */
export const fetchIndexerTransactionsFor = async (
    address: string,
    txId: string,
    attempts = 30,
): Promise<{ transactions: unknown[]; [key: string]: unknown }> => {
    for (let attempt = 0; attempt < attempts; attempt++) {
        const response = await fetch(
            `${LOCALNET_INDEXER_URL}/v2/accounts/${encodeURIComponent(address)}/transactions?limit=50`,
        )
        if (response.ok) {
            const page = (await response.json()) as {
                transactions: { id?: string }[]
            }
            if (page.transactions?.some(txn => txn.id === txId)) {
                return page as never
            }
        }
        await new Promise(resolve => setTimeout(resolve, 500))
    }
    throw new Error(`indexer never reported ${txId} for ${address}`)
}
