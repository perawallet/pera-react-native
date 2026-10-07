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

import type { AccountsChainAdapter } from '@perawallet/wallet-core-accounts'

const PEIKERT = 9

/** Only what `buildAccount` asks of the accounts adapter. */
export const stubAccountsAdapter = {
    chainId: 'algorand',
    legacyDetails: (custody, entry) => {
        if (custody.kind === 'local' && custody.seed === 'bip39') {
            return {
                hdWalletDetails: {
                    ...custody.hd,
                    change: 0,
                    derivationType: PEIKERT,
                },
            }
        }
        if (custody.kind === 'multisig' && entry.native?.multisig) {
            return { multisigDetails: { ...entry.native.multisig } }
        }
        return {}
    },
} as unknown as AccountsChainAdapter
