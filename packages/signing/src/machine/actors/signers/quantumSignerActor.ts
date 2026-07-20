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
    AnalyzedSignableGroup,
    SigningResult,
} from '../../../pipeline/types'
import {
    createQuantumStrategy,
    type QuantumSigningFunction,
} from '../../../pipeline/signing/createQuantumStrategy'
import type {
    LocalArbitrarySigningFunction,
    LocalArc60SigningFunction,
} from '../../../pipeline/signing/createLocalKeyStrategy'
import { resolveSigningAccount } from '../../utils/resolveSigningAccount'
import { CannotSignError } from '../../../pipeline/errors'

export type QuantumSignerActorInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    signQuantumTransactions: QuantumSigningFunction
    signArbitraryData: LocalArbitrarySigningFunction
    signArc60: LocalArc60SigningFunction
}

/**
 * XState actor that signs all groups whose auth account is a post-quantum
 * (Falcon-1024) account. Structurally identical to {@link localKeySignerActor}
 * — the auth account is resolved per group, then signed — but it builds the
 * dedicated {@link createQuantumStrategy}, so the `transactions` modality
 * yields the pqsig byte carrier (`QuantumSignedTransaction`) rather than a
 * plain algosdk `SignedTransaction`. Returns one SigningResult per group,
 * preserving originalIndices for reassembly.
 */
export const quantumSignerActor = fromPromise<
    SigningResult[],
    QuantumSignerActorInput
>(async ({ input }) => {
    const {
        groups,
        allAccounts,
        signQuantumTransactions,
        signArbitraryData,
        signArc60,
    } = input
    const strategy = createQuantumStrategy({
        signQuantumTransactions,
        signArbitraryData,
        signArc60,
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
            // Delegate rekey resolution to the same canonical helper the
            // local-key actor uses so the dispatcher's classification and the
            // account actually signed stay in lockstep.
            const accountForSigning = resolveSigningAccount(
                signerAccount,
                group.source,
                group.data.type,
                allAccounts,
            )
            return strategy.sign(group, accountForSigning)
        }),
    )
})
