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
    AccountError,
    DerivationTypes,
    type AccountsChainAdapter,
} from '@perawallet/wallet-core-accounts'

export const ethereumLegacyDetails: AccountsChainAdapter['legacyDetails'] =
    custody => {
        if (custody.kind === 'local' && custody.seed === 'bip39') {
            return {
                hdWalletDetails: {
                    account: custody.hd.account,
                    change: 0,
                    keyIndex: custody.hd.keyIndex,
                    // The legacy record requires a derivation type Ethereum
                    // doesn't have; Peikert is what every Algorand entry of
                    // the seed carries, so the two never disagree.
                    derivationType: DerivationTypes.Peikert,
                },
            }
        }
        if (custody.kind === 'multisig') {
            throw new AccountError('Ethereum has no native multisig')
        }
        return {}
    }
