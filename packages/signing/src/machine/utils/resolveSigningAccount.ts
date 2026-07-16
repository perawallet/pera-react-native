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
    resolveAuthAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { SignableData, SourceMetadata } from '../../pipeline/types'

/**
 * Picks the account whose key produces the signature for a signable group.
 *
 * - `multisig-cosign` source: the participant slot is bound to its ORIGINAL
 *   pubkey at multisig creation. Rekey indirection MUST NOT be followed —
 *   the participant signs with its own key.
 * - `arbitrary-data` / `arc60` data: the dApp verifies the signature off-chain
 *   against the requested account's own pubkey. There is no auth-addr lookup
 *   for off-chain data, so the rekey hop MUST NOT be followed.
 * - Transactions (any other shape): standard rekey rule — resolve the single
 *   rekey hop to the auth account, which holds the signing key. Rekey
 *   indirection is not transitive, so this is one hop, not a chain.
 *
 * This is the single canonical statement of the rule. Both the machine
 * dispatcher (which classifies each group's signer type) and the local-key
 * signer actor (which produces the signature) delegate here so the decision
 * stays in lockstep.
 */
export const resolveSigningAccount = (
    signerAccount: WalletAccount,
    source: SourceMetadata,
    dataType: SignableData['type'],
    allAccounts: WalletAccount[],
): WalletAccount => {
    if (source.type === 'multisig-cosign') return signerAccount
    if (dataType === 'arbitrary-data' || dataType === 'arc60') {
        return signerAccount
    }
    return resolveAuthAccount(signerAccount, allAccounts)
}
