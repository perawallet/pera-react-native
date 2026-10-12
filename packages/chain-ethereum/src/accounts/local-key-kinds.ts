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
    accountKindId,
    type AccountKindId,
    type LocalKeyKind,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { SeedScheme } from '@perawallet/wallet-core-kms/constants'

// A raw private key has no phrase; it imports through the descriptor's
// `rawKeySchemes`, not as a key kind.
export const ethereumLocalKeyKinds: readonly LocalKeyKind[] = [
    {
        seed: SeedScheme.Bip39,
        signingScheme: 'secp256k1',
        isHd: true,
        mnemonicWordCounts: [24],
        isAutoDetected: true,
    },
]

export const ethereumKindIdOf = ({ custody }: WalletAccount): AccountKindId => {
    if (custody.kind !== 'local') return accountKindId(custody.kind)
    return accountKindId(custody.seed === null ? 'standalone' : 'hd')
}
