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
    resolveSigningAccount,
    signGroupsBySignerAccount,
    type LocalKeySignerInput,
    type SigningResult,
} from '@perawallet/wallet-core-signing'
import { createLocalKeyStrategy } from './createLocalKeyStrategy'

export const signLocalKeyGroups = async (
    input: LocalKeySignerInput,
): Promise<SigningResult[]> => {
    const {
        groups,
        allAccounts,
        signTransactions,
        signArbitraryData,
        signAuthData,
        scope,
    } = input
    const strategy = createLocalKeyStrategy({
        signTransactions,
        signArbitraryData,
        signAuthData,
        scope,
    })

    return signGroupsBySignerAccount(
        groups,
        allAccounts,
        (group, signerAccount) => {
            // Rekey vs. multisig-cosign handling lives in
            // {@link resolveSigningAccount}. This call is defense-in-depth:
            // the upstream dispatcher (`buildGroupSignerMap`) already
            // classifies cosign groups by the participant's own type, but
            // routing through the same helper keeps signing correct if the
            // dispatch logic ever changes.
            const accountForSigning = resolveSigningAccount(
                signerAccount,
                group.source,
                group.data.type,
                allAccounts,
                scope.chainId,
            )
            return strategy.sign(group, accountForSigning)
        },
        scope.chainId,
    )
}
