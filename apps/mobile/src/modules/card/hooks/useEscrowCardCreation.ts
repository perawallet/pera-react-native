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
    useCreateEscrowCardMutation,
    type CreateEscrowCardResult,
    type FundingType,
} from '@perawallet/wallet-core-card'
import {
    canSignArbitraryData,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    encodeDelegatedLsigAccount,
    ProgramSigningUnsupportedError,
    useArbitraryDataSigner,
    useProgramSigner,
} from '@perawallet/wallet-core-signing'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

export type UseEscrowCardCreationResult = {
    /**
     * Creates the Pera Card for `account`: signs the ARC-60/SIWA ownership
     * proof, and for Auto funding also signs + posts the AutoDraw delegation.
     * Auto degrades to Manual (in the result) if the LSig leg fails.
     */
    createCard: (
        account: WalletAccount,
        fundingType: FundingType,
    ) => Promise<CreateEscrowCardResult>
    isPending: boolean
    /**
     * True only for local-key accounts (Algo25/HD). Ledger/watch/rekeyed
     * accounts can produce neither the SIWA proof nor the delegated LSig, so
     * they can't create a card.
     */
    canCreateCard: (account: WalletAccount) => boolean
}

/**
 * Composes the wallet's arbitrary-data + program signers with the AB card
 * creation mutation, keeping the card package signing-agnostic (the signers are
 * injected per call).
 */
export const useEscrowCardCreation = (): UseEscrowCardCreationResult => {
    const { signArbitraryData } = useArbitraryDataSigner()
    const { signProgram } = useProgramSigner()
    const createMutation = useCreateEscrowCardMutation()
    const { mutateAsync: createEscrowCardAsync } = createMutation

    const canCreateCard = useCallback(
        (account: WalletAccount) =>
            canSignArbitraryData(account) && account.keyPairId != null,
        [],
    )

    const createCard = useCallback(
        (account: WalletAccount, fundingType: FundingType) => {
            // Fail before any network call so nothing is half-applied.
            if (!canCreateCard(account)) {
                throw new ProgramSigningUnsupportedError(account.address)
            }
            return createEscrowCardAsync({
                address: account.address,
                fundingType,
                // SIWA proof: sign "MX" || message (arbitrary-data semantics).
                signSiwaMessage: async message =>
                    (
                        await signArbitraryData(
                            account,
                            encodeToBase64(message),
                        )
                    )[0],
                // AutoDraw LSig: sign "Program" || program, assemble the
                // delegated LogicSigAccount, and return its msgpack bytes.
                signLsigProgram: async program => {
                    const sig = await signProgram(account, program)
                    return encodeDelegatedLsigAccount(
                        program,
                        sig,
                        account.address,
                    )
                },
            })
        },
        [canCreateCard, createEscrowCardAsync, signArbitraryData, signProgram],
    )

    return {
        createCard,
        isPending: createMutation.isPending,
        canCreateCard,
    }
}
