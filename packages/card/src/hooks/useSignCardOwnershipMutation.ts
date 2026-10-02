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

import { useMutation } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    buildSiwxAuthData,
    type AuthDataMetadata,
    type AuthData,
} from '@perawallet/wallet-core-signing'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { fetchDelegationToken } from '../api/delegation'
import { toCardMutationResult, type CardMutationResult } from './types'

// The sign-in proof binds to a domain/uri identifying Pera. The mobile
// app has none of its own, so it sends a stable Pera identity.
const CARD_SIGN_IN_DOMAIN = 'perawallet.app'
const CARD_SIGN_IN_URI = 'https://perawallet.app'
const CARD_SIGN_IN_STATEMENT = 'Prove address ownership'

export type SignCardOwnershipVariables = {
    /** Funding-source (delegator) address — the signer. */
    address: string
    /**
     * Signs an auth-data request and returns the raw signature bytes (no "MX"
     * prefix, no re-hashed authenticatorData). Injected so this
     * package stays signing-agnostic — the mobile layer supplies the actual
     * local-key or hardware signer.
     */
    signAuthData: (
        authData: AuthData,
        metadata: AuthDataMetadata,
    ) => Promise<Uint8Array>
}

export type CardOwnershipProof = {
    signData: { data: string; authenticatorData: string }
    signature: string
    /**
     * The single-use token whose nonce is embedded in `signData`. Consumed by
     * the delegation post-approval call that completes card creation.
     */
    delegationToken: string
}

export type UseSignCardOwnershipMutationResult = CardMutationResult<
    SignCardOwnershipVariables,
    CardOwnershipProof
>

/**
 * Step 1 of card creation: builds a fresh sign-in ownership proof and
 * signs it. The proof is handed to the caller, who holds it in memory (never
 * persisted) until Step 2 (create + approve) is triggered. Called again to
 * produce a fresh proof if Step 2 needs a retry — the token is single-use and
 * valid ~10 minutes, so a retry must re-sign rather than reuse.
 */
export const useSignCardOwnershipMutation =
    (): UseSignCardOwnershipMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<
            CardOwnershipProof,
            Error,
            SignCardOwnershipVariables
        >({
            mutationFn: async ({ address, signAuthData }) => {
                // Baanx binds the proof to this token: its nonce has to be
                // inside the payload the user signs, so it is fetched first.
                const { token, nonce } = await fetchDelegationToken({ network })
                const { authData, metadata } = buildSiwxAuthData(
                    scopeForLegacyNetwork(network).chainId,
                    {
                        domain: CARD_SIGN_IN_DOMAIN,
                        address,
                        uri: CARD_SIGN_IN_URI,
                        nonce,
                        statement: CARD_SIGN_IN_STATEMENT,
                    },
                )
                const signature = await signAuthData(authData, metadata)
                return {
                    signData: {
                        data: authData.data,
                        authenticatorData: encodeToBase64(
                            authData.authenticatorData,
                        ),
                    },
                    signature: encodeToBase64(signature),
                    delegationToken: token,
                }
            },
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
