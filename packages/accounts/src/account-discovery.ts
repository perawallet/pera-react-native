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

import {
    type BIP32DerivationType,
    KeyContext,
    XHDWalletAPI,
} from '@algorandfoundation/xhd-wallet-api'
import {
    encodeAlgorandAddress,
    getAlgorandClient,
    useNetworkStore,
} from '@perawallet/wallet-core-blockchain'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { indexerModels } from 'algosdk'
import {
    AccountTypes,
    type HDWalletAccount,
    type WalletAccount,
} from './models/accounts'
import {
    generateOrderedUniqueId,
    fetchAccountFastLookup,
    logger,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { hdDerivedKeyId } from '@perawallet/wallet-core-kms'

const ACCOUNT_GAP_LIMIT = 5
const KEY_INDEX_GAP_LIMIT = 5
// Cap on indexer pages when scanning for accounts rekeyed to an address.
// The indexer returns ~100 accounts per page; very few accounts are ever
// rekeyed to a single auth address, so this is a generous safety bound.
const MAX_REKEYED_SCAN_PAGES = 20

export type GetPublicKey = (params: {
    account: number
    keyIndex: number
    derivationType: BIP32DerivationType
}) => Promise<Uint8Array>

type DiscoverAccountsParams = {
    getPublicKey: GetPublicKey
    derivationType: BIP32DerivationType
    walletKeyId: string
    accountGapLimit?: number
    keyIndexGapLimit?: number
}

/**
 * Builds a `getPublicKey` callback backed by an in-memory XHD root key.
 * Use when discovering before keystore persistence (e.g. mnemonic import).
 */
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

async function checkActivityBatch(
    addresses: string[],
): Promise<Map<string, boolean>> {
    const network = useNetworkStore.getState().network
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
        // gap limit advance the scan. `checkRekeyed` surfaces failures instead.
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

type ScanAccountKeysParams = {
    accountIdx: number
    keyIndexGapLimit: number
    getPublicKey: GetPublicKey
    walletKeyId: string
    derivationType: BIP32DerivationType
}

type ScanResult = {
    activeAccounts: HDWalletAccount[]
    zeroAccount: Nullable<HDWalletAccount>
}

async function scanAccountKeys({
    accountIdx,
    keyIndexGapLimit,
    getPublicKey,
    walletKeyId,
    derivationType,
}: ScanAccountKeysParams): Promise<ScanResult> {
    const activeAccounts: HDWalletAccount[] = []
    let zeroAccount: Nullable<HDWalletAccount> = null
    let keyGap = 0
    let keyIdx = 0

    while (keyGap < keyIndexGapLimit) {
        const batchSize = keyIndexGapLimit
        const keyIndices: number[] = []
        const accountsData: Map<number, HDWalletAccount> = new Map()

        for (let i = 0; i < batchSize; i++) {
            const currentKeyIdx = keyIdx + i
            keyIndices.push(currentKeyIdx)

            const addressBytes = await getPublicKey({
                account: accountIdx,
                keyIndex: currentKeyIdx,
                derivationType,
            })
            const address = encodeAlgorandAddress(addressBytes)

            const accountData: HDWalletAccount = {
                id: generateOrderedUniqueId(),
                address,
                type: AccountTypes.hdWallet,
                keyPairId: hdDerivedKeyId(
                    walletKeyId,
                    accountIdx,
                    currentKeyIdx,
                    derivationType,
                ),
                hdWalletDetails: {
                    account: accountIdx,
                    change: 0,
                    keyIndex: currentKeyIdx,
                    derivationType,
                },
            }

            if (accountIdx === 0 && currentKeyIdx === 0) {
                zeroAccount = accountData
            }

            accountsData.set(currentKeyIdx, accountData)
        }

        const activityMap = await checkActivityBatch(
            Array.from(accountsData.values()).map(a => a.address),
        )

        for (const currentKeyIdx of keyIndices) {
            const accountData = accountsData.get(currentKeyIdx)!
            const isActive = activityMap.get(accountData.address) ?? false

            if (isActive) {
                activeAccounts.push(accountData)
                keyGap = 0
            } else {
                keyGap++
            }

            if (keyGap >= keyIndexGapLimit) break
        }

        if (keyGap >= keyIndexGapLimit) break
        keyIdx += batchSize
    }

    return { activeAccounts, zeroAccount }
}

export async function discoverAccounts({
    getPublicKey,
    derivationType,
    walletKeyId,
    accountGapLimit = ACCOUNT_GAP_LIMIT,
    keyIndexGapLimit = KEY_INDEX_GAP_LIMIT,
}: DiscoverAccountsParams): Promise<HDWalletAccount[]> {
    const foundAccounts: HDWalletAccount[] = []
    let firstAccount: Nullable<HDWalletAccount> = null

    let accountGap = 0
    let accountIndex = 0

    while (accountGap < accountGapLimit) {
        const batchSize = accountGapLimit
        const tasks: Promise<ScanResult>[] = []

        for (let i = 0; i < batchSize; i++) {
            tasks.push(
                scanAccountKeys({
                    accountIdx: accountIndex + i,
                    keyIndexGapLimit,
                    getPublicKey,
                    walletKeyId,
                    derivationType,
                }),
            )
        }

        const results = await Promise.allSettled(tasks)

        for (const result of results) {
            if (result.status === 'rejected') {
                accountGap++
                if (accountGap >= accountGapLimit) break
                continue
            }

            const { activeAccounts, zeroAccount } = result.value

            if (zeroAccount) {
                firstAccount = zeroAccount
            }

            if (activeAccounts.length > 0) {
                foundAccounts.push(...activeAccounts)
                accountGap = 0
            } else {
                accountGap++
            }

            if (accountGap >= accountGapLimit) break
        }

        if (accountGap >= accountGapLimit) break
        accountIndex += batchSize
    }

    if (foundAccounts.length === 0 && firstAccount) {
        return [firstAccount]
    }

    return foundAccounts.sort((a, b) => {
        const aIdx = a.hdWalletDetails
        const bIdx = b.hdWalletDetails
        if (aIdx.account !== bIdx.account) return aIdx.account - bIdx.account
        return aIdx.keyIndex - bIdx.keyIndex
    })
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

/**
 * Public helper for the rescan-rekeyed flow: ask the indexer for every
 * on-chain account whose auth-addr is `address`. Used to surface accounts
 * the user could re-import as watch entries after a rekey was performed
 * outside the wallet. Mirrors Android's `fetchRekeyedAddresses`.
 *
 * `network` is required so the indexer client matches the network-scoped
 * query key callers use (no implicit reliance on the global active-network
 * store), keeping fetch and cache key in lockstep across network switches.
 */
export async function fetchRekeyedAddresses(
    address: string,
    network: Network,
): Promise<string[]> {
    const algorandClient = getAlgorandClient(network)
    const accounts = await checkRekeyed(algorandClient, address)
    return accounts.map(a => a.address)
}

type DiscoverRekeyedAccountsParams = {
    /**
     * Auth addresses to scan: every on-chain account whose auth-addr is one
     * of these is returned as a watch-account candidate labeled with it.
     */
    accountAddresses: string[]
}

/**
 * Finds on-chain accounts rekeyed to any of `accountAddresses` via the
 * indexer's auth-addr query.
 *
 * Address-driven only. A derived-key gap scan used to live here as a
 * fallback when no addresses were passed, but its gap semantics were wrong
 * (the gap advanced on keys with no REKEYS found, not on inactive keys) and
 * every caller passes explicit addresses — removed rather than fixed.
 */
export async function discoverRekeyedAccounts({
    accountAddresses,
}: DiscoverRekeyedAccountsParams): Promise<WalletAccount[]> {
    const algorandClient = getAlgorandClient()

    const tasks = accountAddresses.map(async address => {
        const rekeyedAccounts = await checkRekeyed(algorandClient, address)

        return rekeyedAccounts.map(
            (account: { address: string }): WalletAccount => ({
                id: generateOrderedUniqueId(),
                address: account.address,
                type: AccountTypes.watch,
                rekeyAddress: address,
            }),
        )
    })

    const results = await Promise.all(tasks)
    return results.flat()
}
