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
    canSignArbitraryData,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { concatBytes, decodeFromBase64 } from '@perawallet/wallet-core-shared'
import type { MessageSigningDeps } from '@perawallet/wallet-core-signing'
import { algorandAddressOf, algorandKeyOf } from '../../accounts/vocabulary'

const MX_PREFIX = new TextEncoder().encode('MX')

export const signArbitraryData = async (
    deps: MessageSigningDeps,
    account: WalletAccount,
    data: string[],
): Promise<Uint8Array[]> => {
    // Sign with the requested account's own key. Rekey is NOT
    // followed: the dApp verifies against this account's pubkey.
    const keyPairId = algorandKeyOf(account)
    if (!canSignArbitraryData(account) || !keyPairId) {
        throw new Error(
            `Cannot sign arbitrary data for ${algorandAddressOf(account)}`,
        )
    }

    // Legacy algo_signData: dApps verify against `MX || data`.
    const toSign = data.map(item =>
        concatBytes(MX_PREFIX, decodeFromBase64(item)),
    )
    return deps.signPayloads(keyPairId, toSign)
}
