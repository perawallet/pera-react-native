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

import { fromPromise } from 'xstate'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    SigningResult,
    SourceMetadata,
    TransportResult,
} from '../../../pipeline/types'
import type { TransportFactory } from '../../context'
import { mergeSigningResults } from '../../../utils/mergeSigningResults'
import { resolveSigningAccount } from '../../utils/resolveSigningAccount'

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

        // Transport routing and multisig-template keying must follow the SAME
        // account the signing dispatcher routed on: the account whose key (or
        // multisig template) authorizes the signature. resolveSigningAccount
        // applies the rules — rekey hop for transactions (so a sender rekeyed
        // to a multisig routes to the propose transport keyed on the AUTH's
        // template, not the sender's own type; algod would otherwise reject
        // with "should have been authorized by <auth>"), no hop for cosign
        // participants or `arbitrary-data`, and for `arc60` a hop only when
        // the signer holds no key of its own. Non-rekeyed accounts
        // self-resolve.
        const dataType = signingResults[0]?.signedData.type ?? 'transactions'
        const authAccount = resolveSigningAccount(
            signerAccount,
            source,
            dataType,
            allAccounts,
        )

        const transport = createTransport(source, authAccount)
        const merged = mergeSigningResults(signingResults)

        return transport.send(merged, source, authAccount.address)
    },
)
