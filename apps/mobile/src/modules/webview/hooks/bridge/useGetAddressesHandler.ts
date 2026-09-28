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

import { useCallback } from 'react'
import type WebView from 'react-native-webview'
import {
    AccountTypes,
    canSignWith,
    isRekeyedAccount,
    useAllAccounts,
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { sendMessageToWebview } from '../handlers'
import type { BridgeHandler } from './types'

/**
 * The SDK still accepts the legacy names (`HdKey`, `LedgerBle`, `NoAuth`, …);
 * the webapp is moving to these in lockstep.
 */
type WebviewAccountType =
    | 'Algo25'
    | 'HDWallet'
    | 'Hardware'
    | 'Multisig'
    | 'Quantum'
    | 'Unsignable'
    | 'RekeyedSignable'
    | 'RekeyedUnsignable'

const BASE_WEBVIEW_TYPE: Record<
    WalletAccount['type'],
    Exclude<WebviewAccountType, 'RekeyedSignable' | 'RekeyedUnsignable'>
> = {
    [AccountTypes.algo25]: 'Algo25',
    [AccountTypes.hdWallet]: 'HDWallet',
    [AccountTypes.hardware]: 'Hardware',
    [AccountTypes.multisig]: 'Multisig',
    [AccountTypes.watch]: 'Unsignable',
    // Quantum gets its own name rather than being aliased to `Algo25`:
    // "Algo25" would state something untrue about the key type. A dApp told
    // `Algo25` expects a 64-byte Ed25519 signature it can verify against a
    // recoverable public key; a quantum account hands back a ~1.2 KB Falcon
    // signature and yields no Ed25519 public key at all. The webapp is being
    // updated to these names in lockstep (see the type comment above), so
    // adding a name is the correct move here.
    [AccountTypes.quantum]: 'Quantum',
}

/**
 * Only invoked on already-filtered `signingAccounts`, so `Unsignable` and
 * `RekeyedUnsignable` never emit in practice — mapped anyway so the bridge stays
 * self-contained if that filter loosens.
 */
const toWebviewAccountType = (
    account: WalletAccount,
    accounts: WalletAccount[],
): WebviewAccountType => {
    if (isRekeyedAccount(account)) {
        return canSignWith(account, accounts)
            ? 'RekeyedSignable'
            : 'RekeyedUnsignable'
    }
    return BASE_WEBVIEW_TYPE[account.type]
}

export const useGetAddressesHandler = (
    webview: Nullable<WebView>,
): BridgeHandler => {
    const signingAccounts = useSigningAccounts()
    const allAccounts = useAllAccounts()

    return useCallback(
        message => {
            // Matches Android's `GetAuthorizedAddressesInfoWebMessages`. Send
            // the RAW `account.name`, empty when unset: the webapp owns the
            // truncated-address fallback, and sending that as both name and
            // address made its rows render the same string twice. Ordering is
            // the consumer's responsibility.
            const payload = signingAccounts.map(account => ({
                name: account.name ?? '',
                address: account.address,
                type: toWebviewAccountType(account, allAccounts),
            }))
            sendMessageToWebview(message.id, payload, webview)
        },
        [signingAccounts, allAccounts, webview],
    )
}
