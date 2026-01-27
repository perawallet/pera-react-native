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
import { AccountTypes, HDWalletAccount } from './models/accounts'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'

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

export const discoverAccounts = async ({
    seed,
    derivationType,
    walletId,
    accountGapLimit = ACCOUNT_GAP_LIMIT,
    keyIndexGapLimit = KEY_INDEX_GAP_LIMIT,
}: DiscoverAccountsParams): Promise<HDWalletAccount[]> => {
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

        for (const { activeAccounts, zeroAccount } of results) {
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
