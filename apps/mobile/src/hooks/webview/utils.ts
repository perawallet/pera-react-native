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

import {
    canSignWithAccount,
    isAlgo25Account,
    isHDWalletAccount,
    isLedgerAccount,
    isMultisigAccount,
    isRekeyedAccount,
    isWatchAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

export const getAccountType = (account: WalletAccount) => {
    if (isRekeyedAccount(account) && !canSignWithAccount(account))
        return 'Rekeyed'
    if (isRekeyedAccount(account) && canSignWithAccount(account))
        return 'RekeyedAuth'
    if (isHDWalletAccount(account)) return 'HdKey'
    if (isLedgerAccount(account)) return 'LedgerBle'
    if (isAlgo25Account(account)) return 'Algo25'
    if (isWatchAccount(account)) return 'NoAuth'
    if (isMultisigAccount(account)) return 'Multisig'
    return 'Unknown'
}
