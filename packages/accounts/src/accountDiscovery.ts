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
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { AccountTypes, HDWalletAccount } from './models/accounts'

const ACCOUNT_GAP_LIMIT = 5
const KEY_INDEX_GAP_LIMIT = 5

const api = new XHDWalletAPI()

type DiscoverAccountsParams = {
    seed: Buffer
    derivationType: BIP32DerivationType
    algorandClient: AlgorandClient
    walletId: string
    accountGapLimit?: number
    keyIndexGapLimit?: number
}

export const discoverAccounts = async ({
    seed,
    derivationType,
    algorandClient,
    walletId,
    accountGapLimit = ACCOUNT_GAP_LIMIT,
    keyIndexGapLimit = KEY_INDEX_GAP_LIMIT,
}: DiscoverAccountsParams): Promise<HDWalletAccount[]> => {
    const checkActivity = async (address: string) => {
        try {
            const accountInfo =
                await algorandClient.client.algod.accountInformation(address)

            return (
                accountInfo.amount > 0 ||
                (accountInfo.assets?.length ?? 0) > 0 ||
                (accountInfo.appsLocalState?.length ?? 0) > 0 ||
                (accountInfo.appsTotalSchema?.numUints ?? 0) > 0 ||
                (accountInfo.appsTotalSchema?.numByteSlices ?? 0) > 0
            )
        } catch {
            // Algod returns 404 for empty accounts
            return false
        }
    }
    const rootKey = fromSeed(seed)
    const foundAccounts: HDWalletAccount[] = []
    let accountGap = 0
    let accountIndex = 0
    let activeAccountCount = 0

    while (accountGap < accountGapLimit && activeAccountCount < 5) {
        let keyIndexGap = 0
        let keyIndex = 0
        let isAccountActive = false

        while (keyIndexGap < keyIndexGapLimit) {
            if (accountIndex === 0 && keyIndex === 0) {
                keyIndex++
                continue
            }

            const addressBytes = await api.keyGen(
                rootKey,
                KeyContext.Address,
                accountIndex,
                keyIndex,
                derivationType,
            )
            const address = encodeAlgorandAddress(addressBytes)

            const hasActivity = await checkActivity(address)

            if (hasActivity) {
                isAccountActive = true
                keyIndexGap = 0
                foundAccounts.push({
                    id: uuidv7(),
                    address,
                    type: AccountTypes.hdWallet,
                    canSign: true,
                    hdWalletDetails: {
                        walletId,
                        account: accountIndex,
                        change: 0,
                        keyIndex,
                        derivationType,
                    },
                })
            } else {
                keyIndexGap++
            }

            keyIndex++
        }

        if (isAccountActive) {
            accountGap = 0
            activeAccountCount++
        } else {
            accountGap++
        }

        accountIndex++
    }

    return foundAccounts
}
