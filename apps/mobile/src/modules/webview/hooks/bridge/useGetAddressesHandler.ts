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
    chainAccountOf,
    useAllAccounts,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { sendMessageToWebview } from '../handlers'
import type { BridgeHandler } from './types'

export const useGetAddressesHandler = (
    webview: Nullable<WebView>,
): BridgeHandler => {
    const signingAccounts = useSigningAccounts(LEGACY_CHAIN_ID)
    const allAccounts = useAllAccounts()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)

    return useCallback(
        message => {
            // Matches Android's `GetAuthorizedAddressesInfoWebMessages`. Send
            // the RAW `account.name`, empty when unset: the webapp owns the
            // truncated-address fallback, and sending that as both name and
            // address made its rows render the same string twice. Ordering is
            // the consumer's responsibility.
            const adapter = dappRequestChainAdapters.get(LEGACY_CHAIN_ID)
            const payload = signingAccounts.flatMap(account => {
                const address = chainAccountOf(
                    account,
                    LEGACY_CHAIN_ID,
                )?.address
                return address === undefined
                    ? []
                    : [
                          {
                              name: account.name ?? '',
                              address,
                              type: adapter.accountTypeOf(
                                  account,
                                  allAccounts,
                                  scope,
                              ),
                          },
                      ]
            })
            sendMessageToWebview(message.id, payload, webview)
        },
        [signingAccounts, allAccounts, scope, webview],
    )
}
