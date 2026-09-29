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

import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    AccountTypes,
    type DerivationType,
    type HDWalletAccount,
    type WalletAccount,
} from './models/accounts'
import {
    generateOrderedUniqueId,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { hdDerivedKeyId } from '@perawallet/wallet-core-kms'
import {
    accountsAdapterFor,
    addressCodecFor,
    ed25519DeriveOpts,
    fetchRekeyedAddresses,
    type GetPublicKey,
} from './chain-adapter'

const ACCOUNT_GAP_LIMIT = 5
const KEY_INDEX_GAP_LIMIT = 5

type DiscoverAccountsParams = {
    getPublicKey: GetPublicKey
    derivationType: DerivationType
    walletKeyId: string
    accountGapLimit?: number
    keyIndexGapLimit?: number
}

type ScanAccountKeysParams = {
    accountIdx: number
    keyIndexGapLimit: number
    getPublicKey: GetPublicKey
    walletKeyId: string
    derivationType: DerivationType
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
    const network = useNetworkStore.getState().network
    const adapter = accountsAdapterFor(network)
    const codec = addressCodecFor(network)
    const deriveOpts = ed25519DeriveOpts(network)
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
            const address = codec.fromPublicKey(addressBytes, deriveOpts)

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

        const activityMap = await adapter.checkActivity(
            Array.from(accountsData.values()).map(a => a.address),
            scopeForLegacyNetwork(network),
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

type DiscoverRekeyedAccountsParams = {
    /**
     * Auth addresses to scan: every on-chain account whose auth-addr is one
     * of these is returned as a watch-account candidate labeled with it.
     */
    accountAddresses: string[]
}

/**
 * Finds on-chain accounts rekeyed to any of `accountAddresses` on the active
 * network.
 *
 * Address-driven only. A derived-key gap scan used to live here as a
 * fallback when no addresses were passed, but its gap semantics were wrong
 * (the gap advanced on keys with no REKEYS found, not on inactive keys) and
 * every caller passes explicit addresses — removed rather than fixed.
 */
export async function discoverRekeyedAccounts({
    accountAddresses,
}: DiscoverRekeyedAccountsParams): Promise<WalletAccount[]> {
    const network = useNetworkStore.getState().network

    const tasks = accountAddresses.map(async address => {
        const rekeyedAddresses = await fetchRekeyedAddresses(address, network)

        return rekeyedAddresses.map((rekeyedAddress): WalletAccount => ({
            id: generateOrderedUniqueId(),
            address: rekeyedAddress,
            type: AccountTypes.watch,
            rekeyAddress: address,
        }))
    })

    const results = await Promise.all(tasks)
    return results.flat()
}
