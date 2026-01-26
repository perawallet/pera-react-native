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

export const discoverAccounts = async ({
    seed,
    derivationType,
    walletId,
    accountGapLimit = ACCOUNT_GAP_LIMIT,
    keyIndexGapLimit = KEY_INDEX_GAP_LIMIT,
}: DiscoverAccountsParams): Promise<HDWalletAccount[]> => {
    const algorandClient = getAlgorandClient()
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
    let firstAccount: HDWalletAccount | null = null

    let accountGap = 0
    let accountIndex = 0

    while (accountGap < accountGapLimit) {
        let keyIndexGap = 0
        let keyIndex = 0

        while (keyIndexGap < keyIndexGapLimit) {
            const addressBytes = await api.keyGen(
                rootKey,
                KeyContext.Address,
                accountIndex,
                keyIndex,
                derivationType,
            )
            const address = encodeAlgorandAddress(addressBytes)

            // Create potential account object
            const accountData: HDWalletAccount = {
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
            }

            if (accountIndex === 0 && keyIndex === 0) {
                firstAccount = accountData
            }

            const hasActivity = await checkActivity(address)

            if (hasActivity) {
                foundAccounts.push(accountData)
                keyIndexGap = 0
                accountGap = 0
            } else {
                keyIndexGap++
            }

            keyIndex++
        }

        accountGap++
        accountIndex++
    }

    if (foundAccounts.length === 0 && firstAccount) {
        return [firstAccount]
    }

    return foundAccounts
}
