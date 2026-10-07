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
    type AccountsChainAdapter,
} from '@perawallet/wallet-core-accounts'
import { ALGORAND_HD_DERIVATION_TYPE } from './constants'

export const algorandLegacyDetails: AccountsChainAdapter['legacyDetails'] = (
    custody,
    entry,
) => {
    if (custody.kind === 'local' && custody.seed === 'bip39') {
        return {
            hdWalletDetails: {
                account: custody.hd.account,
                change: 0,
                keyIndex: custody.hd.keyIndex,
                derivationType: ALGORAND_HD_DERIVATION_TYPE,
            },
        }
    }
    if (custody.kind === 'multisig') {
        const multisig = entry.native?.multisig
        if (!multisig) {
            throw new AccountError(
                'A multisig account needs its multisig on the Algorand chain',
            )
        }
        return {
            multisigDetails: {
                threshold: multisig.threshold,
                addresses: [...multisig.addresses],
                version: multisig.version,
            },
        }
    }
    return {}
}
