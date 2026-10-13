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
    chainAccountOf,
    signingKeyOn,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

// Flow fixtures seed accounts on the legacy chain only, so a missing entry is
// a broken fixture rather than a case to tolerate.
export const addressOf = (account: WalletAccount): string => {
    const address = chainAccountOf(account, LEGACY_CHAIN_ID)?.address
    if (address === undefined) {
        throw new Error(`Account ${account.id} has no ${LEGACY_CHAIN_ID} entry`)
    }
    return address
}

export const keyPairIdOf = (account: WalletAccount): string | undefined =>
    signingKeyOn(account, LEGACY_CHAIN_ID)
