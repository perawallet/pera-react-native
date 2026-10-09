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

import type {
    LocalKeyKind,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { SeedScheme } from '@perawallet/wallet-core-kms/constants'
import { accountType, AccountTypes, type AccountType } from './vocabulary'

// Detection scans in this order, so algo25 must stay above quantum: both are
// 25 words, and a 25-word phrase must never be silently imported as quantum.
export const algorandLocalKeyKinds: readonly LocalKeyKind[] = [
    {
        seed: SeedScheme.Bip39,
        signingScheme: 'ed25519',
        isHd: true,
        mnemonicWordCounts: [24],
        isAutoDetected: true,
    },
    {
        seed: SeedScheme.Algo25,
        signingScheme: 'ed25519',
        isHd: false,
        mnemonicWordCounts: [25],
        isAutoDetected: true,
    },
    {
        seed: SeedScheme.Quantum,
        signingScheme: 'falcon-1024',
        isHd: false,
        mnemonicWordCounts: [25],
        isAutoDetected: false,
    },
]

/**
 * `quantum` ranks highest because misreporting it is the expensive failure —
 * the backend prices a quantum account's swap quotes at the Ed25519 minimum
 * fee and the chain rejects the swap, with no client-side symptom. `watch`
 * ranks lowest because it carries no signing capability, so dropping it in
 * favour of anything else can only ever gain the user capability.
 *
 * In practice only `watch` can genuinely collide with another type — an
 * Algorand address is derived from its key, so one address cannot be two
 * different signing schemes — but the order is total so the rule stays
 * deterministic rather than a special case.
 */
const ACCOUNT_TYPE_RANK = {
    [AccountTypes.quantum]: 6,
    [AccountTypes.hardware]: 5,
    [AccountTypes.hdWallet]: 4,
    [AccountTypes.algo25]: 3,
    [AccountTypes.multisig]: 2,
    [AccountTypes.watch]: 1,
} as const satisfies Record<AccountType, number>

export const algorandDuplicateRank = (account: WalletAccount): number =>
    ACCOUNT_TYPE_RANK[accountType(account)]
