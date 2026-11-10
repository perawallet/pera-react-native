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
import { DAPP_KIND, EIP1193_DAPP_KIND } from '@perawallet/wallet-core-dapp/wire'
import type { ConnectionKind } from '@perawallet/wallet-extension-connections'

/** A site's page-level access through an injected provider, not a paired WalletConnect session. */
export const isSiteConnectionKind = (kind: ConnectionKind): boolean =>
    kind === DAPP_KIND || kind === EIP1193_DAPP_KIND

export type ConnectionKindCopy = {
    badgeKey: I18nKey
    deleteTitleKey: I18nKey
    /** Takes `{ origin }`; the WalletConnect body ignores it. */
    deleteBodyKey: I18nKey
    confirmKey: I18nKey
    cancelKey: I18nKey
    fallbackIcon: 'globe' | 'wallet-connect'
}

const SITE_COPY: ConnectionKindCopy = {
    badgeKey: i18nKey('settings.connections.badge_dapp'),
    deleteTitleKey: i18nKey('settings.connected_sites.revoke_title'),
    deleteBodyKey: i18nKey('settings.connected_sites.revoke_body'),
    confirmKey: i18nKey('settings.connected_sites.revoke_confirm'),
    cancelKey: i18nKey('settings.connected_sites.revoke_cancel'),
    fallbackIcon: 'globe',
}

const WALLET_CONNECT_COPY: ConnectionKindCopy = {
    badgeKey: i18nKey('settings.connections.badge_wallet_connect'),
    deleteTitleKey: i18nKey('walletconnect.settings.delete_title'),
    deleteBodyKey: i18nKey('walletconnect.settings.delete_body'),
    confirmKey: i18nKey('common.delete.label'),
    cancelKey: i18nKey('common.cancel.label'),
    fallbackIcon: 'wallet-connect',
}

export const connectionKindCopy = (kind: ConnectionKind): ConnectionKindCopy =>
    isSiteConnectionKind(kind) ? SITE_COPY : WALLET_CONNECT_COPY
