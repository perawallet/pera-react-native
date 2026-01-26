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

import {
    BIP32DerivationType,
    fromSeed,
    XHDWalletAPI,
    KeyContext,
} from '@algorandfoundation/xhd-wallet-api'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'

const api = new XHDWalletAPI()

export type DiscoveredAccount = {
    accountIndex: number
    keyIndex: number
    address: string
}

export type CheckActivityFn = (address: string) => Promise<boolean>

type DiscoverAccountsParams = {
    seed: Buffer
    derivationType: BIP32DerivationType
    checkActivity: CheckActivityFn
    accountGapLimit?: number
    keyIndexGapLimit?: number
}

export const discoverAccounts = async ({
    seed,
    derivationType,
    checkActivity,
    accountGapLimit = 5,
    keyIndexGapLimit = 5,
}: DiscoverAccountsParams): Promise<DiscoveredAccount[]> => {
    const rootKey = fromSeed(seed)
    const foundAccounts: DiscoveredAccount[] = []
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

            // If this is 0/0, it's the root account. We consider it "active" usually if it exists?
            // Actually, we should check activity for all.
            const hasActivity = await checkActivity(address)

            if (hasActivity) {
                isAccountActive = true
                keyIndexGap = 0
                foundAccounts.push({
                    accountIndex,
                    keyIndex,
                    address,
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
            // If checking account 0 and it has no active keys, is it a gap?
            // Yes.
            accountGap++
        }

        accountIndex++
    }

    return foundAccounts
}
