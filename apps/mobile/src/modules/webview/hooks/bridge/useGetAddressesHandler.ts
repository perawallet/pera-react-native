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
    canSignWith,
    chainAccountOf,
    isRekeyedAccount,
    useAllAccounts,
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { sendMessageToWebview } from '../handlers'
import type { BridgeHandler } from './types'

/**
 * Only invoked on already-filtered `signingAccounts`, so the unsignable kinds
 * never emit in practice — mapped anyway so the bridge stays self-contained if
 * that filter loosens.
 */
const toWebviewAccountType = (
    account: WalletAccount,
    accounts: WalletAccount[],
    chainId: ChainId,
): string => {
    if (isRekeyedAccount(account, chainId)) {
        return canSignWith(account, accounts, chainId)
            ? 'RekeyedSignable'
            : 'RekeyedUnsignable'
    }
    return dappRequestChainAdapters.get(chainId).accountTypeOf(account)
}

export const useGetAddressesHandler = (
    webview: Nullable<WebView>,
): BridgeHandler => {
    const signingAccounts = useSigningAccounts(LEGACY_CHAIN_ID)
    const allAccounts = useAllAccounts()

    return useCallback(
        message => {
            // Matches Android's `GetAuthorizedAddressesInfoWebMessages`. Send
            // the RAW `account.name`, empty when unset: the webapp owns the
            // truncated-address fallback, and sending that as both name and
            // address made its rows render the same string twice. Ordering is
            // the consumer's responsibility.
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
                              type: toWebviewAccountType(
                                  account,
                                  allAccounts,
                                  LEGACY_CHAIN_ID,
                              ),
                          },
                      ]
            })
            sendMessageToWebview(message.id, payload, webview)
        },
        [signingAccounts, allAccounts, webview],
    )
}
