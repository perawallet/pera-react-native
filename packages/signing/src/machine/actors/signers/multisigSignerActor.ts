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
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import type {
    AnalyzedSignableGroup,
    SigningCallbacks,
    SigningResult,
} from '../../../pipeline/types'
import { createSigningStrategySelector } from '../../../pipeline/signing/getSigningStrategy'
import {
    buildDeferredProposeSigningResult,
    getProposeParticipants,
    shouldDeferPropose,
} from '../../../pipeline/signing/utils'
import type {
    LocalSigningFunction,
    LocalArbitrarySigningFunction,
    LocalArc60SigningFunction,
} from '../../../pipeline/signing/createLocalKeyStrategy'
import type { QuantumSigningFunction } from '../../../pipeline/signing/createQuantumStrategy'
import type { EncodeTransactionFunction } from '../../../pipeline/signing/createHardwareStrategy'
import { signGroupsBySignerAccount } from './signGroupsBySignerAccount'

export type MultisigSignerActorInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    signTransactions: LocalSigningFunction
    signQuantumTransactions: QuantumSigningFunction
    signArbitraryData: LocalArbitrarySigningFunction
    signArc60: LocalArc60SigningFunction
    encodeTransaction: EncodeTransactionFunction
    hardwareWalletRegistry?: HardwareWalletRegistry
    signingCallbacks?: SigningCallbacks
}

/**
 * XState actor that signs each multisig group with every local-key (Algo25
 * or HD) participant in parallel, producing one combined SigningResult per
 * group. Hardware-wallet participants are deliberately skipped here:
 * `getProposeParticipants` filters them out so a Ledger device prompt
 * never auto-fires during Send. The user signs hardware participants
 * explicitly via the per-row Sign button in `PendingSignaturesContent`
 * once the propose call completes and the sheet opens (via
 * `useMultisigProposeListener`).
 *
 * Hardware-only proposer case (no local-key participant exists): the actor
 * short-circuits via `shouldDeferPropose` and returns an empty-signers
 * `SigningResult`. The propose transport recognizes this as a defer signal,
 * skips the backend propose call, and instead creates a local draft via
 * an injected `createDraftSignRequest` function. The pending-signatures
 * sheet then opens with a synthetic draft state, and the user's first
 * per-row Sign on a Ledger row bootstraps the real backend propose.
 *
 * This runs on the propose flow (creating a new multisig transaction). The
 * cosign flow uses a different entry point: the PendingSignaturesBottomSheet
 * dispatches per-participant `multisig-cosign` requests with `signerOverrides`
 * pinned to a specific address — those bypass `getProposeParticipants` and
 * route directly to the participant's strategy via `selectStrategy`.
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
        signQuantumTransactions,
        signArbitraryData,
        signArc60,
        encodeTransaction,
        hardwareWalletRegistry,
        signingCallbacks,
    } = input

    const selectStrategy = createSigningStrategySelector({
        signTransactions,
        signQuantumTransactions,
        signArbitraryData,
        signArc60,
        encodeTransaction,
        hardwareWalletRegistry,
        getLocalParticipants: getProposeParticipants,
        getAllAccounts: () => allAccounts,
    })

    return signGroupsBySignerAccount(
        groups,
        allAccounts,
        (group, signerAccount) => {
            if (shouldDeferPropose(signerAccount, allAccounts)) {
                return buildDeferredProposeSigningResult(group)
            }
            const strategy = selectStrategy(signerAccount, allAccounts)
            return strategy.sign(group, signerAccount, signingCallbacks)
        },
    )
})
