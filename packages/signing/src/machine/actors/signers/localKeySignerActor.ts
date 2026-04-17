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
import type {
    WalletAccount,
    AuthAddressLookup,
} from '@perawallet/wallet-core-accounts'
import type {
    AnalyzedSignableGroup,
    SigningResult,
} from '../../../pipeline/types'
import {
    createLocalKeyStrategy,
    type LocalSigningFunction,
    type LocalArbitrarySigningFunction,
    type LocalArc60SigningFunction,
} from '../../../pipeline/signing/createLocalKeyStrategy'
import { resolveAuthAccount } from '@perawallet/wallet-core-accounts'
import { CannotSignError } from '../../../pipeline/errors'

export type LocalKeySignerActorInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    authAddresses: AuthAddressLookup
    signTransactions: LocalSigningFunction
    signArbitraryData: LocalArbitrarySigningFunction
    signArc60: LocalArc60SigningFunction
}

/**
 * XState actor that signs all groups using local keys (Algo25 / HDWallet).
 * Each group carries its own signerAddress, so multi-signer requests are
 * handled correctly: the auth account is resolved per group, then signed.
 * Returns one SigningResult per group, preserving originalIndices for reassembly.
 */
export const localKeySignerActor = fromPromise<
    SigningResult[],
    LocalKeySignerActorInput
>(async ({ input }) => {
    const {
        groups,
        allAccounts,
        authAddresses,
        signTransactions,
        signArbitraryData,
        signArc60,
    } = input
    const strategy = createLocalKeyStrategy({
        signTransactions,
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
            const authAccount = resolveAuthAccount(
                signerAccount,
                allAccounts,
                authAddresses.get(signerAccount.address),
            )
            return strategy.sign(group, authAccount)
        }),
    )
})
