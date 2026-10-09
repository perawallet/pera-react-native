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

import {
    createChainAdapterRegistry,
    scopeForLegacyNetwork,
    type ChainAccountNative,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type { MultisigSignRequest } from './models'

/** Chain-encoded: `version` and the participant order are part of the address hash. */
export type MultisigParameters = {
    version: number
    threshold: number
    addresses: string[]
}

/** `signatures[i]` matches `rawTransactions[i]`; null means "didn't sign". */
export type ParticipantResponse = {
    address: string
    response: 'signed' | 'declined'
    signatures?: Nullable<string>[]
}

export type AssembleSignedMultisigParams = {
    /** Base64 of each unsigned transaction in the chain's wire encoding. */
    rawTransactionsBase64: string[]
    /** In the same order as the on-chain multisig. */
    participantAddresses: string[]
    version: number
    threshold: number
    /** Only entries with `response: 'signed'` contribute signatures. */
    responses: ParticipantResponse[]
    /** A sender that differs from this is rekeyed to the multisig. Omit for plain multisig spends. */
    multisigAddress?: string
}

export type AssembleSignedMultisigResult =
    | { kind: 'success'; signedTransactionsBytes: Uint8Array[] }
    /**
     * Retryable, unlike `error`: the backend can flip a request to `ready`
     * before every signature payload is serialized, so a poll-driven caller
     * should treat this as "not yet".
     */
    | {
          kind: 'insufficient-signatures'
          txIndex: number
          validCount: number
          threshold: number
      }
    | { kind: 'error'; reason: string }

export type MultisigSignRequestValidation =
    | { kind: 'valid' }
    /** The joint address doesn't derive from the request's own participant set. */
    | { kind: 'address-mismatch' }
    | { kind: 'no-transactions' }
    | { kind: 'unauthorized-sender'; txIndex: number }

/** The chain-specific legs of a multisig account; registered by the chain package. */
export interface MultisigChainAdapter {
    chainId: ChainId
    deriveAddress(parameters: MultisigParameters): string
    /** The parameters an account's chain entry stores; `undefined` when a legacy record lacks them. */
    parametersOf(
        native: ChainAccountNative | undefined,
    ): MultisigParameters | undefined
    /** The chain entry data that stores `parameters`. */
    toNative(parameters: MultisigParameters): ChainAccountNative
    /**
     * Verifies every signature against the transaction bytes before building
     * the envelopes: the coordination backend is a relay, not a trust anchor.
     */
    assembleSignedTransactions(
        params: AssembleSignedMultisigParams,
    ): Promise<AssembleSignedMultisigResult>
    /**
     * Checks the first transaction list of a request a participant is about
     * to cosign. `authorizedSenders` must include the joint address itself
     * plus any account rekeyed to it.
     */
    validateSignRequest(
        request: MultisigSignRequest,
        authorizedSenders: ReadonlySet<string>,
    ): MultisigSignRequestValidation
}

export const multisigChainAdapters =
    createChainAdapterRegistry<MultisigChainAdapter>('multisig')

// Every legacy `Network` belongs to one chain; chain-contract owns that mapping.
export const multisigAdapterFor = (network: Network): MultisigChainAdapter =>
    multisigChainAdapters.get(scopeForLegacyNetwork(network).chainId)
