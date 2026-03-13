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

import { fromPromise } from 'xstate'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { PeraSignedTransaction } from '@perawallet/wallet-core-blockchain'
import type {
    SigningResult,
    SourceMetadata,
    TransportResult,
} from '../../../pipeline/types'
import { createTransportSelector } from '../../../pipeline/transports/getTransport'
import type { AlgokitClientInterface } from '../../../pipeline/transports/createAlgodTransport'
import type { ProposeSignRequestFn } from '../../../pipeline/transports/createMultisigProposeTransport'
import type { AddSignaturesFn } from '../../../pipeline/transports/createMultisigCosignTransport'

export type TransportActorInput = {
    signingResults: SigningResult[]
    source: SourceMetadata
    /** The account that initiated the transaction (used for multisig detection) */
    signerAccount: WalletAccount
    /** For multisig: the joint (multisig) account address */
    jointAccountAddress?: string
    /** AlgorandClient for direct algod submission */
    algokit: AlgokitClientInterface
    /** Encodes signed transactions to raw bytes */
    encodeSignedTransactions: (txns: PeraSignedTransaction[]) => Uint8Array[]
    /** Backend API: propose new multisig request */
    proposeSignRequest: ProposeSignRequestFn
    /** Backend API: add signatures to existing multisig request */
    addSignatures: AddSignaturesFn
}

/**
 * Merges multiple signing results (one per group) into a single SigningResult
 * so the downstream transport interface stays unchanged.
 * For transactions: concatenates all signed arrays across groups.
 */
const mergeSigningResults = (results: SigningResult[]): SigningResult => {
    if (results.length === 1) {
        return results[0]
    }

    const allSigned = results.flatMap(r =>
        r.signedData.type === 'transactions' ? r.signedData.signed : [],
    )

    return {
        signedData: { type: 'transactions', signed: allSigned },
        signers: results.flatMap(r => r.signers),
    }
}

/**
 * XState actor that delivers signed data to the appropriate destination.
 * Uses createTransportSelector to route between algod, WalletConnect,
 * multisig-propose, and multisig-cosign transports.
 */
export const transportActor = fromPromise<TransportResult, TransportActorInput>(
    async ({ input }) => {
        const {
            signingResults,
            source,
            signerAccount,
            jointAccountAddress,
            algokit,
            encodeSignedTransactions,
            proposeSignRequest,
            addSignatures,
        } = input

        const selectTransport = createTransportSelector({
            algokit,
            encodeSignedTransactions,
            proposeSignRequest,
            addSignatures,
        })

        const transport = selectTransport(source, signerAccount)
        const merged = mergeSigningResults(signingResults)

        return transport.send(merged, source, jointAccountAddress)
    },
)
