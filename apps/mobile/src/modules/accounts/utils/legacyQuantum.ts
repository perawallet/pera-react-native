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
    isQuantumAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    PQ_DERIVATION_CANONICAL,
    type PQDerivation,
    type useKMS,
} from '@perawallet/wallet-core-kms'

type GetKey = ReturnType<typeof useKMS>['getKey']

/**
 * Whether `account`'s quantum signing child is legacy-derivation.
 *
 * Deliberately `!== CANONICAL` rather than `=== LEGACY`: a canonical child is
 * always stamped at mint time, but migration 0004 swallows per-key stamping
 * failures (`safeWarn`, always resolves), so a child that failed to be
 * stamped keeps `pqDerivation: undefined` forever. Treating `undefined` the
 * same as canonical would silently withhold the warning from an account that
 * really is legacy — the account that most needs it. `undefined` can only
 * mean an unstamped legacy child, so it must fail closed into "legacy",
 * matching the fail-closed pattern `repairQuantumMaterial.ts` already uses
 * for this exact ambiguity.
 */
export const isLegacyQuantumChild = (
    getKey: GetKey,
    account: WalletAccount,
): boolean => {
    if (!isQuantumAccount(account)) return false
    const pqDerivation = (
        getKey(account.keyPairId)?.metadata as
            | { pqDerivation?: PQDerivation }
            | undefined
    )?.pqDerivation
    return pqDerivation !== PQ_DERIVATION_CANONICAL
}
