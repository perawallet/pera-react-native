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

import { canSignArbitraryData } from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useCallback } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { decodeFromBase64, concatBytes } from '@perawallet/wallet-core-shared'
import { SIGNING_KEY_DOMAIN } from '../constants'

const MX_PREFIX = new TextEncoder().encode('MX')

export const useArbitraryDataSigner = () => {
    const { signDataWithKey } = useKMS()

    const signArbitraryData = useCallback(
        async (
            account: WalletAccount,
            data: string | string[],
        ): Promise<Uint8Array[]> => {
            // Sign with the requested account's own key. Rekey is NOT
            // followed: the dApp verifies against this account's pubkey.
            if (!canSignArbitraryData(account) || !account.keyPairId) {
                return Promise.reject(
                    new Error(
                        `Cannot sign arbitrary data for ${account.address}`,
                    ),
                )
            }

            // Legacy algo_signData: dApps verify against `MX || data`.
            const items = [data].flat()
            const toSign = items.map(item =>
                concatBytes(MX_PREFIX, decodeFromBase64(item)),
            )
            return signDataWithKey(
                account.keyPairId,
                SIGNING_KEY_DOMAIN,
                toSign,
            )
        },
        [signDataWithKey],
    )

    return {
        signArbitraryData,
    }
}
