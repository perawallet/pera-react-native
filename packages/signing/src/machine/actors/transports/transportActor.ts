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
import {
    chainAccountOf,
    findAccountByAddressOn,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type {
    SigningResult,
    SourceMetadata,
    TransportResult,
} from '../../../pipeline/types'
import type { TransportFactory } from '../../context'
import {
    plannerAdapterForScope,
    plannerChainAdapters,
} from '../../../chain-adapter'
import { CannotSignError } from '../../../pipeline/errors'
import { resolveSigningAccount } from '../../utils/resolveSigningAccount'

export type TransportActorInput = {
    signingResults: SigningResult[]
    source: SourceMetadata
    /**
     * Primary signer address (from first group).
     * Looked up in allAccounts to determine transport routing.
     */
    signerAddress: string
    isKeyedByPlanner: boolean
    /** All user accounts — used to resolve the signer WalletAccount */
    allAccounts: WalletAccount[]
    /** Selects the correct transport (algod, callback, multisig, etc.) */
    createTransport: TransportFactory
    scope: ChainScope
}

// A chain with no planner adapter has nothing to merge, so it delivers its
// single group as signed.
const mergeResults = (
    scope: ChainScope,
    signingResults: SigningResult[],
): SigningResult => {
    if (plannerChainAdapters.has(scope.chainId)) {
        return plannerAdapterForScope(scope).mergeSigningResults(signingResults)
    }
    if (signingResults.length !== 1) {
        throw new Error(
            `Chain ${scope.chainId} cannot merge ${signingResults.length} signing results`,
        )
    }
    return signingResults[0]
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
            isKeyedByPlanner,
            allAccounts,
            createTransport,
            scope,
        } = input

        const signerAccount = findAccountByAddressOn(
            allAccounts,
            scope.chainId,
            signerAddress,
        )
        if (!signerAccount) {
            throw new Error(
                `Signer account not found for transport: ${signerAddress}`,
            )
        }

        // A group keyed by its planner already names the key holder. Otherwise,
        // transport routing and multisig-template keying must follow the SAME
        // account the signing dispatcher routed on: the account whose key (or
        // multisig template) authorizes the signature. resolveSigningAccount
        // applies the rules — rekey hop for transactions (so a sender rekeyed
        // to a multisig routes to the propose transport keyed on the AUTH's
        // template, not the sender's own type; algod would otherwise reject
        // with "should have been authorized by <auth>"), and no hop for cosign
        // participants or off-chain data (`arbitrary-data`, `auth-data`).
        // Non-rekeyed accounts self-resolve.
        const signedType = signingResults[0]?.signedData.type ?? 'transactions'
        const authAccount = isKeyedByPlanner
            ? signerAccount
            : resolveSigningAccount(
                  signerAccount,
                  source,
                  signedType === 'signed-transactions'
                      ? 'transactions'
                      : signedType,
                  allAccounts,
                  scope.chainId,
              )

        const authAddress = chainAccountOf(authAccount, scope.chainId)?.address
        if (authAddress === undefined) {
            throw new CannotSignError(
                signerAddress,
                `its signing account has no address on chain ${scope.chainId}`,
            )
        }

        const transport = createTransport(source, authAccount)
        const merged = mergeResults(scope, signingResults)

        return transport.send(merged, source, authAddress)
    },
)
