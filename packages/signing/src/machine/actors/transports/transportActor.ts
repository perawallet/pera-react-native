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
import type { TransportFactory } from '../../context'

export type TransportActorInput = {
    signingResults: SigningResult[]
    source: SourceMetadata
    /**
     * Primary signer address (from first group).
     * Looked up in allAccounts to determine transport routing.
     */
    signerAddress: string
    /** All user accounts — used to resolve the signer WalletAccount */
    allAccounts: WalletAccount[]
    /** Selects the correct transport (algod, callback, multisig, etc.) */
    createTransport: TransportFactory
}

/**
 * Merges multiple signing results (one per group) into a single SigningResult
 * so the downstream transport interface stays unchanged.
 *
 * For multi-signer requests, each group carries originalIndices indicating
 * where its signed transactions belong in the full request array. The signed
 * transactions are placed back at their original positions rather than
 * concatenated, preserving the correct submission order.
 */
const mergeSigningResults = (results: SigningResult[]): SigningResult => {
    if (results.length === 1) {
        return results[0]
    }

    const allIndices = results.flatMap(r => r.originalIndices ?? [])
    const totalCount = allIndices.length > 0 ? Math.max(...allIndices) + 1 : 0
    const reordered = new Array<PeraSignedTransaction>(totalCount)

    for (const result of results) {
        if (result.signedData.type !== 'transactions') continue
        const { signed } = result.signedData
        const indices = result.originalIndices
        if (indices) {
            indices.forEach((origIdx, i) => {
                reordered[origIdx] = signed[i]
            })
        }
    }

    return {
        signedData: { type: 'transactions', signed: reordered },
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
            signerAddress,
            allAccounts,
            createTransport,
        } = input

        const signerAccount = allAccounts.find(a => a.address === signerAddress)
        if (!signerAccount) {
            throw new Error(
                `Signer account not found for transport: ${signerAddress}`,
            )
        }

        const transport = createTransport(source, signerAccount)
        const merged = mergeSigningResults(signingResults)

        return transport.send(merged, source, signerAddress)
    },
)
