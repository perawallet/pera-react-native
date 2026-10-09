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
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { LocalAccount, WalletAccount } from './models/accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { buildAccount, hdIndexOf } from './credentials'
import { recordAuthority } from './store/recordAuthority'
import {
    accountsChainAdapters,
    fetchRekeyedAddresses,
    hdDeriveOpts,
    type GetPublicKey,
} from './chain-adapter'

const ACCOUNT_GAP_LIMIT = 5
const KEY_INDEX_GAP_LIMIT = 5

type DiscoverAccountsParams = {
    scope: ChainScope
    getPublicKey: GetPublicKey
    walletKeyId: string
    accountGapLimit?: number
    keyIndexGapLimit?: number
}

type ScanAccountKeysParams = {
    scope: ChainScope
    accountIdx: number
    keyIndexGapLimit: number
    getPublicKey: GetPublicKey
    walletKeyId: string
}

type ScanResult = {
    activeAccounts: LocalAccount[]
    zeroAccount: Nullable<LocalAccount>
}

async function scanAccountKeys({
    scope,
    accountIdx,
    keyIndexGapLimit,
    getPublicKey,
    walletKeyId,
}: ScanAccountKeysParams): Promise<ScanResult> {
    const adapter = accountsChainAdapters.get(scope.chainId)
    const codec = addressCodecs.get(scope.chainId)
    const deriveOpts = hdDeriveOpts(scope)
    const addressOf = (account: WalletAccount) =>
        account.chains[scope.chainId]?.address ?? ''
    const activeAccounts: LocalAccount[] = []
    let zeroAccount: Nullable<LocalAccount> = null
    let keyGap = 0
    let keyIdx = 0

    while (keyGap < keyIndexGapLimit) {
        const batchSize = keyIndexGapLimit
        const keyIndices: number[] = []
        const accountsData: Map<number, LocalAccount> = new Map()

        for (let i = 0; i < batchSize; i++) {
            const currentKeyIdx = keyIdx + i
            keyIndices.push(currentKeyIdx)

            const hd = { account: accountIdx, keyIndex: currentKeyIdx }
            const addressBytes = await getPublicKey(hd)
            const address = codec.fromPublicKey(addressBytes, deriveOpts)

            const accountData = buildAccount({
                custody: { kind: 'local', seed: 'bip39', hd },
                chainId: adapter.chainId,
                chains: {
                    [adapter.chainId]: {
                        address,
                        keyPairId: adapter.hdKeyPairId(walletKeyId, hd),
                    },
                },
            })

            if (accountIdx === 0 && currentKeyIdx === 0) {
                zeroAccount = accountData
            }

            accountsData.set(currentKeyIdx, accountData)
        }

        const activityMap = await adapter.checkActivity(
            Array.from(accountsData.values()).map(addressOf),
            scope,
        )

        for (const currentKeyIdx of keyIndices) {
            const accountData = accountsData.get(currentKeyIdx)!
            const isActive = activityMap.get(addressOf(accountData)) ?? false

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
    scope,
    getPublicKey,
    walletKeyId,
    accountGapLimit = ACCOUNT_GAP_LIMIT,
    keyIndexGapLimit = KEY_INDEX_GAP_LIMIT,
}: DiscoverAccountsParams): Promise<LocalAccount[]> {
    const foundAccounts: LocalAccount[] = []
    let firstAccount: Nullable<LocalAccount> = null

    let accountGap = 0
    let accountIndex = 0

    while (accountGap < accountGapLimit) {
        const batchSize = accountGapLimit
        const tasks: Promise<ScanResult>[] = []

        for (let i = 0; i < batchSize; i++) {
            tasks.push(
                scanAccountKeys({
                    scope,
                    accountIdx: accountIndex + i,
                    keyIndexGapLimit,
                    getPublicKey,
                    walletKeyId,
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
        const aIdx = hdIndexOf(a) ?? { account: 0, keyIndex: 0 }
        const bIdx = hdIndexOf(b) ?? { account: 0, keyIndex: 0 }
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
    scope: ChainScope
}

/**
 * Finds on-chain accounts rekeyed to any of `accountAddresses` on `scope`.
 *
 * Address-driven only. A derived-key gap scan used to live here as a
 * fallback when no addresses were passed, but its gap semantics were wrong
 * (the gap advanced on keys with no REKEYS found, not on inactive keys) and
 * every caller passes explicit addresses — removed rather than fixed.
 */
export async function discoverRekeyedAccounts({
    accountAddresses,
    scope,
}: DiscoverRekeyedAccountsParams): Promise<WalletAccount[]> {
    const { chainId } = scope

    const tasks = accountAddresses.map(async address => {
        const rekeyedAddresses = await fetchRekeyedAddresses(address, scope)

        return rekeyedAddresses.map((rekeyedAddress): WalletAccount => {
            recordAuthority(scope, rekeyedAddress, address)
            return buildAccount({
                custody: { kind: 'watch' },
                chainId,
                chains: { [chainId]: { address: rekeyedAddress } },
            })
        })
    })

    const results = await Promise.all(tasks)
    return results.flat()
}
