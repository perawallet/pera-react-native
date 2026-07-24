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
import {
    ARC60_SCOPE_AUTH,
    buildSiwaAuthRequest,
    type Arc60Metadata,
    type Arc60StdSigData,
} from '@perawallet/wallet-core-signing'
import {
    encodeToBase64,
    generateUniqueId,
} from '@perawallet/wallet-core-shared'
import { toCardMutationResult, type CardMutationResult } from './types'

// The ARC-60 SIWA proof binds to a domain/uri identifying Pera. The mobile
// app has none of its own, so it sends a stable Pera identity.
const CARD_SIWA_DOMAIN = 'perawallet.app'
const CARD_SIWA_URI = 'https://perawallet.app'
const CARD_SIWA_STATEMENT = 'Prove address ownership'

export type SignCardOwnershipVariables = {
    /** Funding-source (delegator) address — the ARC-60 signer. */
    address: string
    /**
     * Signs an ARC-60 AUTH-scope request and returns the raw signature bytes
     * (no "MX" prefix, no re-hashed authenticatorData). Injected so this
     * package stays signing-agnostic — the mobile layer supplies the actual
     * local-key or hardware signer.
     */
    signArc60: (
        stdSigData: Arc60StdSigData,
        metadata: Arc60Metadata,
    ) => Promise<Uint8Array>
}

export type CardOwnershipProof = {
    signData: { data: string; authenticatorData: string }
    signature: string
}

export type UseSignCardOwnershipMutationResult = CardMutationResult<
    SignCardOwnershipVariables,
    CardOwnershipProof
>

/**
 * Step 1 of card creation: builds a fresh ARC-60 SIWA ownership proof and
 * signs it. No network call — the proof is handed to the caller, who holds it
 * in memory (never persisted) until Step 2 (create + approve) is triggered.
 * Called again to produce a fresh proof if Step 2 needs a retry.
 */
export const useSignCardOwnershipMutation =
    (): UseSignCardOwnershipMutationResult => {
        const mutation = useMutation<
            CardOwnershipProof,
            Error,
            SignCardOwnershipVariables
        >({
            mutationFn: async ({ address, signArc60 }) => {
                const { data, authenticatorData } = buildSiwaAuthRequest({
                    domain: CARD_SIWA_DOMAIN,
                    accountAddress: address,
                    uri: CARD_SIWA_URI,
                    nonce: generateUniqueId(),
                    statement: CARD_SIWA_STATEMENT,
                })
                const stdSigData: Arc60StdSigData = {
                    data,
                    signer: address,
                    domain: CARD_SIWA_DOMAIN,
                    authenticatorData,
                }
                const signature = await signArc60(stdSigData, {
                    scope: ARC60_SCOPE_AUTH,
                    encoding: 'base64',
                })
                return {
                    signData: {
                        data,
                        authenticatorData: encodeToBase64(authenticatorData),
                    },
                    signature: encodeToBase64(signature),
                }
            },
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
