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
 * - `arbitrary-data` data: the dApp verifies the signature off-chain against
 *   the requested account's own pubkey, and the ARC-1 response carries only
 *   raw signatures — there is no field to report that a different key signed.
 *   The rekey hop MUST NOT be followed.
 * - `arc60` data: the hop IS followed. SIWA names the authenticated account
 *   (`account_address`) separately from the signing key, so a verifier
 *   resolves the auth-addr on chain and the auth account is the correct
 *   producer (PERA-4977).
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
    if (dataType === 'arbitrary-data') return signerAccount
    return resolveAuthAccount(signerAccount, allAccounts)
}
