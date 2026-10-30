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

import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'

export type ConnectionPermission =
    | 'view-accounts'
    | 'approve-transactions'
    | 'sign-messages'
    | 'switch-networks'

export const CONNECTION_PERMISSION_COPY: Readonly<
    Record<ConnectionPermission, I18nKey>
> = {
    'view-accounts': i18nKey('walletconnect.permissions.view_accounts'),
    'approve-transactions': i18nKey(
        'walletconnect.permissions.approve_transactions',
    ),
    'sign-messages': i18nKey('walletconnect.permissions.sign_messages'),
    'switch-networks': i18nKey('walletconnect.permissions.switch_networks'),
}

// A method no entry names grants nothing beyond reading the address.
const METHOD_PERMISSIONS: Readonly<Record<string, ConnectionPermission>> = {
    algo_signTxn: 'approve-transactions',
    requestTransactionSigning: 'approve-transactions',
    eth_sendTransaction: 'approve-transactions',
    wallet_sendCalls: 'approve-transactions',
    algo_signData: 'sign-messages',
    requestDataSigning: 'sign-messages',
    personal_sign: 'sign-messages',
    eth_signTypedData_v4: 'sign-messages',
    wallet_switchEthereumChain: 'switch-networks',
}

const ORDER: readonly ConnectionPermission[] = [
    'view-accounts',
    'approve-transactions',
    'sign-messages',
    'switch-networks',
]

export const toConnectionPermissions = (
    methods: readonly string[],
): ConnectionPermission[] => {
    const granted = new Set<ConnectionPermission>(['view-accounts'])
    for (const method of methods) {
        const permission = METHOD_PERMISSIONS[method]
        if (permission) granted.add(permission)
    }
    return ORDER.filter(permission => granted.has(permission))
}
