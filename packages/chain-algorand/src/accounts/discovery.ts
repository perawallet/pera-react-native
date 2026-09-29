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

import { KeyContext, XHDWalletAPI } from '@algorandfoundation/xhd-wallet-api'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { indexerModels } from 'algosdk'
import type { GetPublicKey } from '@perawallet/wallet-core-accounts'
import { getAlgorandClient } from '@perawallet/wallet-core-blockchain'
import {
    fetchAccountFastLookup,
    logger,
    type Network,
} from '@perawallet/wallet-core-shared'
import { existsOnChain } from './endpoints'

// Cap on indexer pages when scanning for accounts rekeyed to an address.
// The indexer returns ~100 accounts per page; very few accounts are ever
// rekeyed to a single auth address, so this is a generous safety bound.
const MAX_REKEYED_SCAN_PAGES = 20

/** Backed by an in-memory XHD root key, for discovery before keystore persistence (e.g. mnemonic import). */
export const createXHDGetPublicKey = (rootKey: Uint8Array): GetPublicKey => {
    const api = new XHDWalletAPI()
    return async ({ account, keyIndex, derivationType }) =>
        api.keyGen(
            rootKey,
            KeyContext.Address,
            account,
            keyIndex,
            derivationType,
        )
}

export async function checkAlgorandActivity(
    addresses: string[],
    network: Network,
): Promise<Map<string, boolean>> {
    try {
        const results = await fetchAccountFastLookup(addresses, network)
        const activityMap = new Map<string, boolean>()
        for (const result of results) {
            activityMap.set(result.address, result.accountExists)
        }
        return activityMap
    } catch (error) {
        // Degrading silently is deliberate here: this is the hot path during
        // onboarding, so a failed probe marks the batch inactive and lets the
        // gap limit advance the scan. The rekeyed scan surfaces failures instead.
        //
        // Trap: the probe is the Pera backend, not the indexer, so on a network
        // with no Pera deployment it throws before a socket opens and every
        // address reports as non-existent, indistinguishable from an empty
        // result. The indexer could answer the same question there.
        logger.warn('Pera fast-lookup failed; treating batch as inactive', {
            source: 'account-discovery.checkActivityBatch',
            batchSize: addresses.length,
            error,
        })
        const activityMap = new Map<string, boolean>()
        for (const address of addresses) {
            activityMap.set(address, false)
        }
        return activityMap
    }
}

/**
 * Asks the indexer for every account whose auth-addr is `address`.
 *
 * Throws on indexer failure rather than swallowing it — a network error
 * must not be indistinguishable from "no rekeyed accounts found". Every
 * caller already runs inside a try/catch that surfaces the failure (the
 * rescan screen's error state, the import flow's error logging).
 */
async function checkRekeyed(
    algorandClient: AlgorandClient,
    address: string,
): Promise<indexerModels.Account[]> {
    const accounts: indexerModels.Account[] = []
    let next: string | undefined
    let pages = 0

    // Follow the indexer's pagination token so accounts beyond the first
    // page are not silently dropped.
    do {
        let request = algorandClient.client.indexer
            .searchAccounts()
            .authAddr(address)
        if (next) request = request.nextToken(next)
        const result = await request.do()
        accounts.push(...result.accounts)
        next = result.nextToken
        pages += 1
    } while (next && pages < MAX_REKEYED_SCAN_PAGES)

    if (next) {
        logger.warn('Rekeyed-account scan stopped at the page cap', {
            address,
            pages,
        })
    }

    return accounts
}

export async function fetchAlgorandRekeyedAddresses(
    address: string,
    network: Network,
): Promise<string[]> {
    const accounts = await checkRekeyed(getAlgorandClient(network), address)
    return accounts.map(a => a.address)
}

export const algorandAccountExists = async (
    address: string,
    network: Network,
): Promise<boolean> =>
    existsOnChain(
        await getAlgorandClient(network)
            .client.algod.accountInformation(address)
            .do(),
    )
