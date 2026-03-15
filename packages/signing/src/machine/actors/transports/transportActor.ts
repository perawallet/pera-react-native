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
import type {
    SigningResult,
    SourceMetadata,
    TransportResult,
} from '../../../pipeline/types'
import type { TransportFactory } from '../../context'
import { mergeSigningResults } from '../../../utils/mergeSigningResults'

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
