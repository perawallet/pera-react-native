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

import { useCallback } from 'react'
import { chainAccountOf } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useKMS } from '@perawallet/wallet-core-kms'
import type { LocalArbitrarySigningFunction } from '../chain-adapter'
import { SIGNING_KEY_DOMAIN } from '../constants'
import { messageSignerFor } from '../message-signer'

export type UseArbitraryDataSignerResult = {
    signArbitraryData: (
        chainId: ChainId,
        ...args: Parameters<LocalArbitrarySigningFunction>
    ) => ReturnType<LocalArbitrarySigningFunction>
}

// The caller names the request's chain; the signer resolves the account's address there.
export const useArbitraryDataSigner = (): UseArbitraryDataSignerResult => {
    const { signDataWithKey } = useKMS()

    const signArbitraryData = useCallback<
        UseArbitraryDataSignerResult['signArbitraryData']
    >(
        async (chainId, account, data) =>
            messageSignerFor(
                chainId,
                chainAccountOf(account, chainId)?.address ?? '',
            ).signArbitraryData(
                {
                    signPayloads: (keyPairId, payloads) =>
                        signDataWithKey(
                            keyPairId,
                            SIGNING_KEY_DOMAIN,
                            payloads,
                        ),
                },
                account,
                [data].flat(),
            ),
        [signDataWithKey],
    )

    return { signArbitraryData }
}
