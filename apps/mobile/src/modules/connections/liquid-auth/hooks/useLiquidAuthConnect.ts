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

import { useCallback } from 'react'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { concatBytes, decodeFromBase64 } from '@perawallet/wallet-core-shared'
import {
    buildArc60SignRequest,
    LIQUID_AUTH_PROVIDER_ID,
    LIQUID_AUTH_PROVIDER_NAME,
    liquidAuthNetworksForCurrent,
    useLiquidAuth,
    useLiquidAuthStore,
    type DisplayIdentity,
} from '@perawallet/wallet-core-liquid-auth'
import { useSigningRequest } from '@perawallet/wallet-core-signing'

export type UseLiquidAuthConnectResult = {
    connect: (input: {
        host: string
        requestId: string
        address: string
        requestConfirmation: (identity: DisplayIdentity) => Promise<boolean>
    }) => Promise<void>
    disconnect: (sessionId: string) => void
}

/**
 * Assembles the full `useLiquidAuth` config (provider identity, current
 * network, and the signing collaborators). The caller supplies the account
 * address (chosen in the pre-ceremony approval sheet); there is no implicit
 * "selected account" here because consent precedes the ceremony.
 */
export const useLiquidAuthConnect = (): UseLiquidAuthConnectResult => {
    const { network } = useNetwork()
    const accounts = useAllAccounts()
    const { addSignRequest } = useSigningRequest()
    // No signer: we only submit already-signed (base64 msgpack) txns to algod
    // via the underlying algod client, so the default routed signer is unused.
    const algorand = useAlgorandClient()

    // post_transactions: decode the base64 msgpack signed txns, concatenate,
    // and submit the group to algod, returning the txn ids. Real path — no
    // pipeline involvement needed since the bytes arrive fully signed.
    const submitSignedTxns = useCallback(
        async (stxns: string[]): Promise<string[]> => {
            const decoded = stxns.map(stxn => decodeFromBase64(stxn))
            const concatenated = concatBytes(...decoded)
            const response = (await algorand.client.algod.sendRawTransaction(
                concatenated,
            )) as { txid?: string | string[] }
            const txid = response?.txid
            if (typeof txid === 'string') return [txid]
            if (Array.isArray(txid)) return txid
            return []
        },
        [algorand],
    )

    // sign_message (ARC-60): validate the inbound payload, build the
    // Arc60SignRequest, and enqueue it into the signing pipeline (mirrors
    // useWalletConnectHandlers.handleArc60SignData). The pipeline surfaces the
    // review sheet and delivers the signature back via the callback transport.
    const enqueueArc60: Parameters<typeof useLiquidAuth>[0]['enqueueArc60'] =
        useCallback(
            ({ params, transportId, approve, reject, error }) => {
                const signRequest = buildArc60SignRequest({
                    params,
                    transportId,
                    sessions: useLiquidAuthStore.getState().sessions,
                    accounts,
                    callbacks: { approve, reject, error },
                })
                if (signRequest) {
                    addSignRequest(signRequest)
                }
            },
            [accounts, addSignRequest],
        )

    const { connect, disconnect } = useLiquidAuth({
        providerId: LIQUID_AUTH_PROVIDER_ID,
        name: LIQUID_AUTH_PROVIDER_NAME,
        networks: liquidAuthNetworksForCurrent(network),
        enqueueArc60,
        submitSignedTxns,
    })

    return { connect, disconnect }
}
