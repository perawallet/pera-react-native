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
import {
    ARC60_SCOPE_AUTH,
    buildSiwaAuthRequest,
    type Arc60Metadata,
    type Arc60StdSigData,
} from '@perawallet/wallet-core-signing'
import {
    encodeToBase64,
    generateUniqueId,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    CardIntegrityAttestationRequiredError,
    createCard,
} from '../api/card-creation'
import {
    approveEscrowCard,
    compileAutoDrawProgram,
    postDelegatorLsig,
} from '../api/escrow'
import { DEFAULT_CARD_CURRENCY, FundingType } from '../models'
import { useCardStore } from '../store'
import { toCardMutationResult, type CardMutationResult } from './types'

// The ARC-60 SIWA proof binds to a domain/uri identifying Pera. The mobile
// app has none of its own, so it sends a stable Pera identity.
const CARD_SIWA_DOMAIN = 'perawallet.app'
const CARD_SIWA_URI = 'https://perawallet.app'
const CARD_SIWA_STATEMENT = 'Prove address ownership'

export type CreateEscrowCardVariables = {
    /** Funding-source (delegator) address — the ARC-60 signer. */
    address: string
    /** Funding type chosen on the setup checklist. */
    fundingType: FundingType
    /**
     * Signs an ARC-60 AUTH-scope request and returns the raw signature bytes
     * (no "MX" prefix, no re-hashed authenticatorData). Injected so this
     * package stays signing-agnostic — the mobile layer supplies the actual
     * local-key or hardware signer.
     */
    signArc60: (
        stdSigData: Arc60StdSigData,
        metadata: Arc60Metadata,
    ) => Promise<Uint8Array>
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

type OwnershipProof = {
    signData: { data: string; authenticatorData: string }
    signature: string
}

/**
 * Builds a fresh ARC-60 SIWA ownership proof and signs it. Called once per
 * mutation run — the SAME proof is reused for both the create and approve
 * calls in the common path; only a retry (card already created, approval
 * still pending) calls this again, since the signature itself is never
 * persisted.
 */
const signOwnershipProof = async (
    address: string,
    signArc60: CreateEscrowCardVariables['signArc60'],
): Promise<OwnershipProof> => {
    const { data, authenticatorData } = buildSiwaAuthRequest({
        domain: CARD_SIWA_DOMAIN,
        accountAddress: address,
        uri: CARD_SIWA_URI,
        nonce: generateUniqueId(),
        statement: CARD_SIWA_STATEMENT,
    })
    const stdSigData: Arc60StdSigData = {
        data,
        signer: address,
        domain: CARD_SIWA_DOMAIN,
        authenticatorData,
    }
    const signature = await signArc60(stdSigData, {
        scope: ARC60_SCOPE_AUTH,
        encoding: 'base64',
    })
    return {
        signData: {
            data,
            authenticatorData: encodeToBase64(authenticatorData),
        },
        signature: encodeToBase64(signature),
    }
}

/**
 * Creates the Pera Card via the Pera backend and AB approval and, for Auto
 * funding, authorizes the AutoDraw delegation.
 *
 * 1. If no escrow card exists yet, sign the ARC-60 SIWA ownership proof once,
 *    POST it to the Pera backend (which performs the on-chain `cardCreate`
 *    and returns the card address + txId), persist immediately, then reuse
 *    the SAME proof to call AB's approval endpoint with the txId.
 * 2. If the card exists but wasn't approved (e.g. an app restart between the
 *    two calls), re-sign and retry only the approval call.
 * 3. For Auto funding only, compile the AutoDraw program, sign it, and POST
 *    the signed LSig. Any failure here degrades to Manual (the card still
 *    exists).
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
                signArc60,
                signLsigProgram,
            }) => {
                const currency = DEFAULT_CARD_CURRENCY.toLowerCase()

                // Reuse an already-created card ONLY for the same funding
                // account on the same network (approval-only retry / cold
                // resume). A card created for a different account — or on
                // the other network — must never be reused: that would skip
                // the ownership proof and bind a wrong card.
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
                    if (!integrityToken) {
                        throw new CardIntegrityAttestationRequiredError()
                    }

                    const proof = await signOwnershipProof(address, signArc60)

                    const created = await createCard({
                        network,
                        address,
                        currency,
                        signData: proof.signData,
                        signature: proof.signature,
                        integrityToken,
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

                    await approveEscrowCard({
                        network,
                        address,
                        currency,
                        signData: proof.signData,
                        signature: proof.signature,
                        txId,
                    })
                    useCardStore.getState().markEscrowCardApproved()
                    approved = true
                } else if (!approved) {
                    // The card exists but a prior attempt never completed
                    // approval. The original signature was never persisted,
                    // so produce a fresh one and retry only this leg.
                    const proof = await signOwnershipProof(address, signArc60)
                    await approveEscrowCard({
                        network,
                        address,
                        currency,
                        signData: proof.signData,
                        signature: proof.signature,
                        txId,
                    })
                    useCardStore.getState().markEscrowCardApproved()
                    approved = true
                }

                if (fundingType !== FundingType.Auto) {
                    return {
                        cardAddress,
                        fundingType: FundingType.Manual,
                        autoFundingDegraded: false,
                    }
                }

                // Optional AutoDraw delegation. A failure here must not fail the
                // whole flow: the card is created and approved, so fall back to
                // Manual.
                try {
                    const program = await compileAutoDrawProgram({ network })
                    const lsigBytes = await signLsigProgram(program)
                    await postDelegatorLsig({
                        network,
                        token: currency,
                        delegatorAddress: address,
                        lsigBytes: encodeToBase64(lsigBytes),
                        cardAddress,
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
