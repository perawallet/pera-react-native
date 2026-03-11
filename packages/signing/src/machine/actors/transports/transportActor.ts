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
import type { SigningResult, SourceMetadata, TransportResult } from '../../../pipeline/types'
import { createTransportSelector } from '../../../pipeline/transports/getTransport'
import type { AlgokitClientInterface } from '../../../pipeline/transports/createAlgodTransport'
import type { ProposeSignRequestFn } from '../../../pipeline/transports/createMultisigProposeTransport'
import type { AddSignaturesFn } from '../../../pipeline/transports/createMultisigCosignTransport'

export type TransportActorInput = {
    signingResult: SigningResult
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
 * XState actor that delivers signed data to the appropriate destination.
 * Uses createTransportSelector to route between algod, WalletConnect,
 * multisig-propose, and multisig-cosign transports.
 */
export const transportActor = fromPromise<TransportResult, TransportActorInput>(
    async ({ input }) => {
        const {
            signingResult,
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

        return transport.send(signingResult, source, jointAccountAddress)
    },
)
