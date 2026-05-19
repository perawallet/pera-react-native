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
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import type {
    AnalyzedSignableGroup,
    SigningCallbacks,
    SigningResult,
} from '../../../pipeline/types'
import { createSigningStrategySelector } from '../../../pipeline/signing/getSigningStrategy'
import { getLocalParticipants } from '../../../pipeline/signing/utils'
import type {
    LocalSigningFunction,
    LocalArbitrarySigningFunction,
    LocalArc60SigningFunction,
} from '../../../pipeline/signing/createLocalKeyStrategy'
import type { EncodeTransactionFunction } from '../../../pipeline/signing/createHardwareStrategy'
import { CannotSignError } from '../../../pipeline/errors'

export type MultisigSignerActorInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    signTransactions: LocalSigningFunction
    signArbitraryData: LocalArbitrarySigningFunction
    signArc60: LocalArc60SigningFunction
    encodeTransaction: EncodeTransactionFunction
    hardwareWalletRegistry?: HardwareWalletRegistry
    signingCallbacks?: SigningCallbacks
}

/**
 * XState actor that signs each multisig group with every local participant
 * (Algo25, HD, and hardware-wallet) in parallel, producing one combined
 * SigningResult per group. Hardware participants trigger the standard
 * LedgerSigningContent sheet during signing.
 *
 * This runs on the propose flow (creating a new multisig transaction). The
 * cosign flow uses a different entry point: the PendingSignaturesBottomSheet
 * dispatches per-participant `multisig-cosign` requests with `signerOverrides`
 * pinned to a specific address — those bypass `getLocalParticipants` and route
 * directly to the participant's strategy via `selectStrategy`.
 *
 * Throws NoLocalParticipantsError (from createMultisigStrategy) if the user
 * has no signing-capable participants in their wallet for the group's
 * multisig account.
 */
export const multisigSignerActor = fromPromise<
    SigningResult[],
    MultisigSignerActorInput
>(async ({ input }) => {
    const {
        groups,
        allAccounts,
        signTransactions,
        signArbitraryData,
        signArc60,
        encodeTransaction,
        hardwareWalletRegistry,
        signingCallbacks,
    } = input

    const selectStrategy = createSigningStrategySelector({
        signTransactions,
        signArbitraryData,
        signArc60,
        encodeTransaction,
        hardwareWalletRegistry,
        getLocalParticipants,
        getAllAccounts: () => allAccounts,
    })

    return Promise.all(
        groups.map(group => {
            const signerAccount = allAccounts.find(
                a => a.address === group.signerAddress,
            )
            if (!signerAccount) {
                throw new CannotSignError(
                    group.signerAddress,
                    'Account not found in allAccounts',
                )
            }
            const strategy = selectStrategy(signerAccount, allAccounts)
            return strategy.sign(group, signerAccount, signingCallbacks)
        }),
    )
})
