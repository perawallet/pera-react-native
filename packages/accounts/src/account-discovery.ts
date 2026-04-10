/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import {
    encodeAlgorandAddress,
    getAlgorandClient,
    useNetworkStore,
} from '@perawallet/wallet-core-blockchain'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { Account } from '@algorandfoundation/algokit-utils/indexer-client'
import type { KMSHDWalletSession } from '@perawallet/wallet-core-kms'
import {
    AccountTypes,
    HDWalletAccount,
    WalletAccount,
    WatchAccount,
} from './models/accounts'
import {
    generateOrderedUniqueId,
    fetchAccountFastLookup,
} from '@perawallet/wallet-core-shared'

const ACCOUNT_GAP_LIMIT = 5
const KEY_INDEX_GAP_LIMIT = 5

type DiscoverAccountsParams = {
    session: KMSHDWalletSession
    derivationType: BIP32DerivationType
    walletKeyId: string
    accountGapLimit?: number
    keyIndexGapLimit?: number
    accountAddresses?: string[]
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
    } catch {
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
    session: KMSHDWalletSession
    walletKeyId: string
    derivationType: BIP32DerivationType
}

type ScanResult = {
    activeAccounts: HDWalletAccount[]
    zeroAccount: HDWalletAccount | null
}

async function scanAccountKeys({
    accountIdx,
    keyIndexGapLimit,
    session,
    walletKeyId,
    derivationType,
}: ScanAccountKeysParams): Promise<ScanResult> {
    const activeAccounts: HDWalletAccount[] = []
    let zeroAccount: HDWalletAccount | null = null
    let keyGap = 0
    let keyIdx = 0

    while (keyGap < keyIndexGapLimit) {
        const batchSize = keyIndexGapLimit
        const keyIndices: number[] = []
        const accountsData: Map<number, HDWalletAccount> = new Map()

        for (let i = 0; i < batchSize; i++) {
            const currentKeyIdx = keyIdx + i
            keyIndices.push(currentKeyIdx)

            const addressBytes = await session.getPublicKey({
                account: accountIdx,
                keyIndex: currentKeyIdx,
                derivationType,
            })
            const address = encodeAlgorandAddress(addressBytes)

            const accountData: HDWalletAccount = {
                id: generateOrderedUniqueId(),
                address,
                type: AccountTypes.hdWallet,
                keyPairId: walletKeyId,
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
    session,
    derivationType,
    walletKeyId,
    accountGapLimit = ACCOUNT_GAP_LIMIT,
    keyIndexGapLimit = KEY_INDEX_GAP_LIMIT,
}: DiscoverAccountsParams): Promise<HDWalletAccount[]> {
    const foundAccounts: HDWalletAccount[] = []
    let firstAccount: HDWalletAccount | null = null

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
                    session,
                    walletKeyId,
                    derivationType,
                }),
            )
        }

        const results = await Promise.allSettled(tasks)

        for (const result of results) {
            if (result.status === 'rejected') {
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

async function checkRekeyed(
    algorandClient: AlgorandClient,
    address: string,
): Promise<Account[]> {
    try {
        const result = await algorandClient.client.indexer.searchForAccounts({
            authAddr: address,
        })

        return result.accounts
    } catch (error) {
        console.error('Failed to check rekeyed accounts', error)
        return []
    }
}

type ScanRekeyedKeysParams = {
    accountIdx: number
    keyIndexGapLimit: number
    session: KMSHDWalletSession
    derivationType: BIP32DerivationType
    algorandClient: AlgorandClient
}

async function scanRekeyedKeys({
    accountIdx,
    keyIndexGapLimit,
    session,
    derivationType,
    algorandClient,
}: ScanRekeyedKeysParams): Promise<WalletAccount[]> {
    const foundAccounts: WalletAccount[] = []
    let keyGap = 0
    let keyIdx = 0

    while (keyGap < keyIndexGapLimit) {
        const batchSize = keyIndexGapLimit
        const tasks = []

        for (let i = 0; i < batchSize; i++) {
            const currentKeyIdx = keyIdx + i
            tasks.push(async () => {
                const addressBytes = await session.getPublicKey({
                    account: accountIdx,
                    keyIndex: currentKeyIdx,
                    derivationType,
                })
                const address = encodeAlgorandAddress(addressBytes)
                const rekeyedAccounts = await checkRekeyed(
                    algorandClient,
                    address,
                )

                return rekeyedAccounts.map(
                    (account: { address: string }): WatchAccount => ({
                        id: generateOrderedUniqueId(),
                        address: account.address,
                        type: AccountTypes.watch,
                        rekeyAddress: address,
                    }),
                )
            })
        }

        const results = await Promise.all(tasks.map(t => t()))

        for (const accounts of results) {
            if (accounts.length > 0) {
                foundAccounts.push(...accounts)
                keyGap = 0
            } else {
                keyGap++
            }

            if (keyGap >= keyIndexGapLimit) break
        }

        if (keyGap >= keyIndexGapLimit) break
        keyIdx += batchSize
    }

    return foundAccounts
}

export async function discoverRekeyedAccounts({
    session,
    derivationType,
    accountGapLimit = ACCOUNT_GAP_LIMIT,
    keyIndexGapLimit = KEY_INDEX_GAP_LIMIT,
    accountAddresses,
}: DiscoverAccountsParams): Promise<WalletAccount[]> {
    const algorandClient = getAlgorandClient()

    if (accountAddresses && accountAddresses.length > 0) {
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

    const foundAccounts: WalletAccount[] = []

    let accountGap = 0
    let accountIndex = 0

    while (accountGap < accountGapLimit) {
        const batchSize = accountGapLimit
        const tasks = []

        for (let i = 0; i < batchSize; i++) {
            tasks.push(
                scanRekeyedKeys({
                    accountIdx: accountIndex + i,
                    keyIndexGapLimit,
                    session,
                    derivationType,
                    algorandClient,
                }),
            )
        }

        const results = await Promise.all(tasks)

        for (const accounts of results) {
            if (accounts.length > 0) {
                foundAccounts.push(...accounts)
                accountGap = 0
            } else {
                accountGap++
            }

            if (accountGap >= accountGapLimit) break
        }

        if (accountGap >= accountGapLimit) break
        accountIndex += batchSize
    }

    return foundAccounts
}
