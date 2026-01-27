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

import { v7 as uuidv7 } from 'uuid'
import {
    BIP32DerivationType,
    fromSeed,
    XHDWalletAPI,
    KeyContext,
} from '@algorandfoundation/xhd-wallet-api'
import {
    encodeAlgorandAddress,
    getAlgorandClient,
} from '@perawallet/wallet-core-blockchain'
import { Account } from '@algorandfoundation/algokit-utils/indexer-client'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AccountTypes, Algo25Account, HDWalletAccount } from './models/accounts'

const ACCOUNT_GAP_LIMIT = 5
const KEY_INDEX_GAP_LIMIT = 5

const api = new XHDWalletAPI()

type DiscoverAccountsParams = {
    seed: Buffer
    derivationType: BIP32DerivationType
    walletId: string
    accountGapLimit?: number
    keyIndexGapLimit?: number
}

async function checkActivity(
    algorandClient: AlgorandClient,
    address: string,
): Promise<boolean> {
    try {
        const accountInfo =
            await algorandClient.client.algod.accountInformation(address)

        return (
            accountInfo.amount > 0 ||
            accountInfo.totalAppsOptedIn > 0 ||
            accountInfo.totalAssetsOptedIn > 0 ||
            accountInfo.totalCreatedApps > 0 ||
            accountInfo.totalCreatedAssets > 0
        )
    } catch {
        // Algod returns 404 for empty accounts
        return false
    }
}

type ScanAccountKeysParams = {
    accountIdx: number
    keyIndexGapLimit: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootKey: any
    walletId: string
    derivationType: BIP32DerivationType
    algorandClient: AlgorandClient
}

type ScanResult = {
    activeAccounts: HDWalletAccount[]
    zeroAccount: HDWalletAccount | null
}

async function scanAccountKeys({
    accountIdx,
    keyIndexGapLimit,
    rootKey,
    walletId,
    derivationType,
    algorandClient,
}: ScanAccountKeysParams): Promise<ScanResult> {
    const activeAccounts: HDWalletAccount[] = []
    let zeroAccount: HDWalletAccount | null = null
    let keyGap = 0
    let keyIdx = 0

    while (keyGap < keyIndexGapLimit) {
        const batchSize = keyIndexGapLimit
        const tasks = []

        for (let i = 0; i < batchSize; i++) {
            const currentKeyIdx = keyIdx + i
            tasks.push(async () => {
                const addressBytes = await api.keyGen(
                    rootKey,
                    KeyContext.Address,
                    accountIdx,
                    currentKeyIdx,
                    derivationType,
                )
                const address = encodeAlgorandAddress(addressBytes)

                const accountData: HDWalletAccount = {
                    id: uuidv7(),
                    address,
                    type: AccountTypes.hdWallet,
                    canSign: true,
                    hdWalletDetails: {
                        walletId,
                        account: accountIdx,
                        change: 0,
                        keyIndex: currentKeyIdx,
                        derivationType,
                    },
                }

                let isZeroAccount = false
                if (accountIdx === 0 && currentKeyIdx === 0) {
                    isZeroAccount = true
                }

                const isActive = await checkActivity(algorandClient, address)
                return { isActive, data: accountData, isZeroAccount }
            })
        }

        const results = await Promise.all(tasks.map(t => t()))

        for (const res of results) {
            if (res.isZeroAccount) {
                zeroAccount = res.data
            }

            if (res.isActive) {
                activeAccounts.push(res.data)
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
    seed,
    derivationType,
    walletId,
    accountGapLimit = ACCOUNT_GAP_LIMIT,
    keyIndexGapLimit = KEY_INDEX_GAP_LIMIT,
}: DiscoverAccountsParams): Promise<HDWalletAccount[]> {
    const algorandClient = getAlgorandClient()
    const rootKey = fromSeed(seed)
    const foundAccounts: HDWalletAccount[] = []
    let firstAccount: HDWalletAccount | null = null

    let accountGap = 0
    let accountIndex = 0

    while (accountGap < accountGapLimit) {
        const batchSize = accountGapLimit
        const tasks = []

        for (let i = 0; i < batchSize; i++) {
            tasks.push(
                scanAccountKeys({
                    accountIdx: accountIndex + i,
                    keyIndexGapLimit,
                    rootKey,
                    walletId,
                    derivationType,
                    algorandClient,
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

    return foundAccounts
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
    } catch {
        return []
    }
}

type ScanRekeyedKeysParams = {
    accountIdx: number
    keyIndexGapLimit: number
    rootKey: Uint8Array
    derivationType: BIP32DerivationType
    algorandClient: AlgorandClient
}

async function scanRekeyedKeys({
    accountIdx,
    keyIndexGapLimit,
    rootKey,
    derivationType,
    algorandClient,
}: ScanRekeyedKeysParams): Promise<Algo25Account[]> {
    const foundAccounts: Algo25Account[] = []
    let keyGap = 0
    let keyIdx = 0

    while (keyGap < keyIndexGapLimit) {
        const batchSize = keyIndexGapLimit
        const tasks = []

        for (let i = 0; i < batchSize; i++) {
            const currentKeyIdx = keyIdx + i
            tasks.push(async () => {
                const addressBytes = await api.keyGen(
                    rootKey,
                    KeyContext.Address,
                    accountIdx,
                    currentKeyIdx,
                    derivationType,
                )
                const address = encodeAlgorandAddress(addressBytes)
                const rekeyedAccounts = await checkRekeyed(
                    algorandClient,
                    address,
                )

                return rekeyedAccounts.map(
                    (account: { address: string }): Algo25Account => ({
                        id: uuidv7(),
                        address: account.address,
                        type: AccountTypes.algo25,
                        canSign: true,
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
    seed,
    derivationType,
    accountGapLimit = ACCOUNT_GAP_LIMIT,
    keyIndexGapLimit = KEY_INDEX_GAP_LIMIT,
}: DiscoverAccountsParams): Promise<Algo25Account[]> {
    const algorandClient = getAlgorandClient()
    const rootKey = fromSeed(seed)
    const foundAccounts: Algo25Account[] = []

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
                    rootKey,
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
