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
import { useAppIntegrityStore } from '@perawallet/wallet-core-app-integrity'
import { isDev, isStaging } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    CardIntegrityAttestationRequiredError,
    createCard,
} from '../api/card-creation'
import { approveEscrowCard } from '../api/escrow'
import { DEFAULT_CARD_CURRENCY } from '../models'
import { useCardStore } from '../store'
import { toCardMutationResult, type CardMutationResult } from './types'
import type { CardOwnershipProof } from './useSignCardOwnershipMutation'

export type CreateAndApproveCardVariables = {
    /** Funding-source (delegator) address that produced `proof`. */
    address: string
    /** The Step-1 ownership proof, held in memory by the caller. */
    proof: CardOwnershipProof
}

export type CreateAndApproveCardResult = {
    /** The created (or already-existing) escrow card account address. */
    cardAddress: string
}

export type UseCreateAndApproveCardMutationResult = CardMutationResult<
    CreateAndApproveCardVariables,
    CreateAndApproveCardResult
>

/** The current non-expired device attestation token, or null. */
const getValidIntegrityToken = (): Nullable<string> => {
    const { integrityToken, expiresAt } = useAppIntegrityStore.getState()
    if (!integrityToken || !expiresAt) {
        return null
    }
    const expiry = Date.parse(expiresAt)
    return Number.isFinite(expiry) && expiry > Date.now()
        ? integrityToken
        : null
}

/**
 * Step 2 of card creation: POSTs the Step-1 proof to the Pera backend (which
 * performs the on-chain `cardCreate` and returns the card address + txId),
 * persists immediately, then reuses the SAME proof to call AB's approval
 * endpoint with the txId.
 *
 * Idempotent by (address, network): if a card already exists for this
 * account, its creation is skipped; if it exists but wasn't approved (e.g. an
 * app restart between create and approve), only the approval call retries —
 * both cases still require a Step-1 proof, since a retry's original signature
 * is never persisted.
 */
export const useCreateAndApproveCardMutation =
    (): UseCreateAndApproveCardMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<
            CreateAndApproveCardResult,
            Error,
            CreateAndApproveCardVariables
        >({
            mutationFn: async ({ address, proof }) => {
                const currency = DEFAULT_CARD_CURRENCY.toLowerCase()

                // Reuse an already-created card ONLY for the same funding
                // account on the same network. A card created for a
                // different account — or on the other network — must never
                // be reused: that would skip the ownership proof and bind a
                // wrong card.
                const store = useCardStore.getState()
                const sameOwnerNetwork =
                    store.escrowCardOwner === address &&
                    store.escrowCardNetwork === network
                let cardAddress = sameOwnerNetwork
                    ? store.escrowCardAddress
                    : null
                let txId = sameOwnerNetwork ? store.escrowCardTxId : null
                let approved = sameOwnerNetwork
                    ? store.escrowCardApproved
                    : false

                if (!cardAddress || !txId) {
                    const integrityToken = getValidIntegrityToken()
                    if (!integrityToken && !(isDev || isStaging)) {
                        throw new CardIntegrityAttestationRequiredError()
                    }

                    const created = await createCard({
                        network,
                        address,
                        currency,
                        signData: proof.signData,
                        signature: proof.signature,
                        integrityToken: integrityToken ?? '',
                    })
                    cardAddress = created.cardAddress
                    txId = created.txId
                    // Durable from here — the card exists on-chain, bound to
                    // the account that proved ownership and to this network,
                    // even if the approval call below fails.
                    useCardStore.getState().setEscrowCard({
                        cardAddress,
                        ownerAddress: address,
                        network,
                        txId,
                    })
                    approved = false
                }

                if (!approved) {
                    await approveEscrowCard({
                        network,
                        address,
                        currency,
                        signData: proof.signData,
                        signature: proof.signature,
                        txId,
                    })
                    useCardStore.getState().markEscrowCardApproved()
                }

                return { cardAddress }
            },
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
