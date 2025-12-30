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

import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { AccountTypes, type WalletAccount } from './models'

export const getAccountDisplayName = (account: WalletAccount | null) => {
    if (!account) return 'No Account'
    if (account.name) return account.name
    if (!account.address) return 'No Address Found'
    return truncateAlgorandAddress(account.address)
}

export const isHDWalletAccount = (account: WalletAccount) => {
    return !!account.hdWalletDetails
}

export const isLedgerAccount = (account: WalletAccount) => {
    return (
        account.type === AccountTypes.hardware &&
        account.hardwareDetails?.manufacturer === 'ledger'
    )
}

export const isRekeyedAccount = (account: WalletAccount) => {
    return !!account.rekeyAddress
}

export const isAlgo25Account = (account: WalletAccount) => {
    return account.type === AccountTypes.standard && !account.hdWalletDetails
}

export const isWatchAccount = (account: WalletAccount) => {
    return account.type === AccountTypes.watch
}

export const isMultisigAccount = (account: WalletAccount) => {
    return account.type === AccountTypes.multisig
}

export const canSignWithAccount = (account: WalletAccount) => {
    return account.canSign
}
