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
import {
    chainAccountOf,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useKMS } from '@perawallet/wallet-core-kms'
import type { LocalAuthDataSigningFunction } from '../chain-adapter'
import { SIGNING_KEY_DOMAIN } from '../constants'
import { messageSignerFor } from '../message-signer'

export type UseAuthDataSignerResult = {
    /**
     * Produces a single auth-data signature for the given signer account.
     * Rejects with the chain's own error for every refusal, so the caller can
     * surface a precise reason to the dApp.
     */
    signAuthData: (
        chainId: ChainId,
        ...args: Parameters<LocalAuthDataSigningFunction>
    ) => ReturnType<LocalAuthDataSigningFunction>
}

// Local-key-only path. A Ledger account takes the hardware strategy instead,
// so it never reaches this hook.
export const useAuthDataSigner = (): UseAuthDataSignerResult => {
    const { signDataWithKey } = useKMS()
    const accounts = useAllAccounts()

    const signAuthData = useCallback<UseAuthDataSignerResult['signAuthData']>(
        async (chainId, account, authData, metadata) =>
            messageSignerFor(
                chainId,
                chainAccountOf(account, chainId)?.address ?? '',
            ).signAuthData(
                {
                    signPayloads: (keyPairId, payloads) =>
                        signDataWithKey(
                            keyPairId,
                            SIGNING_KEY_DOMAIN,
                            payloads,
                        ),
                },
                account,
                authData,
                metadata,
                accounts,
            ),
        // `accounts` backs the signer's rekey cross-check; without it the
        // callback would validate against the account list as of first render
        // and fail open on a rekey revoked after mount.
        [signDataWithKey, accounts],
    )

    return { signAuthData }
}
