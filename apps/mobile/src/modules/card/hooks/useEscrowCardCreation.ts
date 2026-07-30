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

import { useCallback } from 'react'
import {
    useCreateAndApproveCardMutation,
    useSignCardOwnershipMutation,
    type CardOwnershipProof,
    type CreateAndApproveCardResult,
} from '@perawallet/wallet-core-card'
import {
    canSignArbitraryData,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    ProgramSigningUnsupportedError,
    UserRejectedSigningError,
    useSigningRequest,
    type Arc60Metadata,
    type Arc60StdSigData,
    type PeraArbitraryDataSignResult,
} from '@perawallet/wallet-core-signing'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'

export type UseEscrowCardCreationResult = {
    /** Step 1: signs the ARC-60 SIWA ownership proof. No network call. */
    signOwnership: (account: WalletAccount) => Promise<CardOwnershipProof>
    /** Step 2: POSTs the Step-1 proof to create (or resume) the card, then approves it. */
    createAndApprove: (
        account: WalletAccount,
        proof: CardOwnershipProof,
    ) => Promise<CreateAndApproveCardResult>
    /**
     * True only for local-key accounts (Algo25/HD). Ledger ARC-60 signing is
     * not wired up for card creation yet (see useEscrowCardCreation's plan
     * notes), and watch/rekeyed accounts can produce neither the ARC-60 proof
     * nor the delegated LSig, so none of them can create a card.
     */
    canCreateCard: (account: WalletAccount) => boolean
}

/**
 * Composes the wallet's ARC-60 signer with the card-creation mutations,
 * keeping the card package signing-agnostic (the signer is injected per
 * call). Each step is independently invokable so a caller (the signing
 * screen) can gate them behind separate user confirmations. Step 3 (Auto
 * funding LSig authorization + on-chain Killswitch enable) lives in
 * `useAutoDrawSwitch` instead — it's shared with the post-onboarding
 * funding-type switch.
 */
export const useEscrowCardCreation = (): UseEscrowCardCreationResult => {
    const { addSignRequest } = useSigningRequest()
    const { mutateAsync: signOwnershipAsync } = useSignCardOwnershipMutation()
    const { mutateAsync: createAndApproveAsync } =
        useCreateAndApproveCardMutation()

    const canCreateCard = useCallback(
        (account: WalletAccount) =>
            canSignArbitraryData(account) && account.keyPairId != null,
        [],
    )

    // Enqueues a first-party ARC-60 request with `sourceType: 'arc60'` (one
    // of the pipeline's INTERACTIVE_SOURCES) so the shared signing pipeline
    // shows the same review screen used for dApp-initiated ARC-60 signing,
    // instead of signing silently behind a bare PIN check.
    const requestArc60Approval = useCallback(
        (
            account: WalletAccount,
            stdSigData: Arc60StdSigData,
            metadata: Arc60Metadata,
        ): Promise<Uint8Array> =>
            new Promise((resolve, reject) => {
                addSignRequest({
                    id: generateOrderedUniqueId(),
                    type: 'arc60',
                    transport: 'callback',
                    sourceType: 'arc60',
                    stdSigData,
                    metadata,
                    approve: async (signed: PeraArbitraryDataSignResult[]) => {
                        resolve(signed[0].signature)
                    },
                    reject: async () => {
                        reject(new UserRejectedSigningError())
                    },
                    error: async err => {
                        reject(err)
                    },
                })
            }),
        [addSignRequest],
    )

    const signOwnership = useCallback(
        (account: WalletAccount) => {
            // Fail before any network call so nothing is half-applied.
            if (!canCreateCard(account)) {
                throw new ProgramSigningUnsupportedError(account.address)
            }
            return signOwnershipAsync({
                address: account.address,
                signArc60: (stdSigData, metadata) =>
                    requestArc60Approval(account, stdSigData, metadata),
            })
        },
        [canCreateCard, signOwnershipAsync, requestArc60Approval],
    )

    const createAndApprove = useCallback(
        (account: WalletAccount, proof: CardOwnershipProof) =>
            createAndApproveAsync({ address: account.address, proof }),
        [createAndApproveAsync],
    )

    return {
        signOwnership,
        createAndApprove,
        canCreateCard,
    }
}
