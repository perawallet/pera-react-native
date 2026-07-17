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
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import {
    encodeToBase64,
    generateUniqueId,
    logger,
} from '@perawallet/wallet-core-shared'
import {
    buildEscrowSiwaMessage,
    buildEscrowSiwaPayload,
    buildEscrowSiwaSignData,
    createEscrowCard,
    submitAutoDrawDelegation,
} from '../api/escrow'
import { DEFAULT_CARD_CURRENCY, FundingType } from '../models'
import { useCardStore } from '../store'
import { toCardMutationResult, type CardMutationResult } from './types'

// SWAP POINT: the SIWA proof binds to a domain/uri the AB verifier expects.
// The demo uses the web app's own host; the mobile app has none, so we send a
// stable Pera identity. Confirm the allowlisted value with AB.
const ESCROW_SIWA_DOMAIN = 'perawallet.app'
const ESCROW_SIWA_URI = 'https://perawallet.app'

export type CreateEscrowCardVariables = {
    /** Funding-source (delegator) address — the SIWA signer. */
    address: string
    /** Funding type chosen on the setup checklist. */
    fundingType: FundingType
    /**
     * Injected from wallet-core-signing (via the mobile hook): raw ed25519 over
     * `"MX" || message`, matching AB's `algosdk.signBytes` verifier.
     */
    signSiwaMessage: (message: Uint8Array) => Promise<Uint8Array>
    /**
     * Injected: signs `"Program" || program` and returns the msgpack-encoded
     * signed delegated LogicSigAccount bytes. Only called for Auto funding.
     */
    signLsigProgram: (program: Uint8Array) => Promise<Uint8Array>
}

export type CreateEscrowCardResult = {
    /** The created escrow card account address. */
    cardAddress: string
    /**
     * Effective funding type. Auto is downgraded to Manual when the (optional)
     * LSig leg fails — the card is already created, so the flow completes on
     * Manual rather than stranding the user.
     */
    fundingType: FundingType
    /** True when Auto was requested but the LSig leg failed. */
    autoFundingDegraded: boolean
}

export type UseCreateEscrowCardMutationResult = CardMutationResult<
    CreateEscrowCardVariables,
    CreateEscrowCardResult
>

/**
 * Creates the Pera Card via the AB escrow service and, for Auto funding,
 * authorizes the AutoDraw delegation.
 *
 * 1. If no escrow card exists yet, sign the ARC-60/SIWA ownership proof and POST
 *    it to AB, which performs the on-chain create and returns the card address.
 *    The address is persisted immediately, so a later LSig failure or a retry
 *    reuses the created card instead of creating a second one.
 * 2. For Auto funding only, compile the AutoDraw program, sign it, and POST the
 *    signed LSig. Any failure here degrades to Manual (the card still exists).
 */
export const useCreateEscrowCardMutation =
    (): UseCreateEscrowCardMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<
            CreateEscrowCardResult,
            Error,
            CreateEscrowCardVariables
        >({
            mutationFn: async ({
                address,
                fundingType,
                signSiwaMessage,
                signLsigProgram,
            }) => {
                const currency = DEFAULT_CARD_CURRENCY.toLowerCase()

                // Reuse an already-created card ONLY for the same funding
                // account on the same network (LSig-only retry / cold resume).
                // A card created for a different account — or on the other
                // network, where the escrow service, app ids, and the card
                // itself don't exist — must never be reused: that would skip
                // the ownership proof and bind a wrong card.
                const store = useCardStore.getState()
                let cardAddress =
                    store.escrowCardOwner === address &&
                    store.escrowCardNetwork === network
                        ? store.escrowCardAddress
                        : null
                if (!cardAddress) {
                    const { genesisHash } = getNetworkConfig(network)
                    const payload = buildEscrowSiwaPayload({
                        domain: ESCROW_SIWA_DOMAIN,
                        genesisHash,
                        address,
                        uri: ESCROW_SIWA_URI,
                        nonce: generateUniqueId(),
                    })
                    const signData = buildEscrowSiwaSignData(payload)
                    const signature = await signSiwaMessage(
                        buildEscrowSiwaMessage(signData),
                    )

                    const created = await createEscrowCard({
                        network,
                        address,
                        currency,
                        signData,
                        signature: encodeToBase64(signature),
                    })
                    cardAddress = created.cardAddress
                    // Durable from here — the card exists on-chain, bound to
                    // the account that proved ownership and to this network.
                    useCardStore.getState().setEscrowCard({
                        cardAddress,
                        ownerAddress: address,
                        network,
                    })
                }

                if (fundingType !== FundingType.Auto) {
                    return {
                        cardAddress,
                        fundingType: FundingType.Manual,
                        autoFundingDegraded: false,
                    }
                }

                // Optional AutoDraw delegation. A failure here must not fail the
                // whole flow: the card is created, so fall back to Manual.
                try {
                    await submitAutoDrawDelegation({
                        network,
                        token: currency,
                        address,
                        cardAddress,
                        signLsigProgram,
                    })
                    return {
                        cardAddress,
                        fundingType: FundingType.Auto,
                        autoFundingDegraded: false,
                    }
                } catch (error) {
                    logger.error(
                        'Card auto-funding LSig authorization failed',
                        {
                            error,
                        },
                    )
                    return {
                        cardAddress,
                        fundingType: FundingType.Manual,
                        autoFundingDegraded: true,
                    }
                }
            },
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
