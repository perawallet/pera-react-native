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

import { describe, it, expect } from 'vitest'
import { connectionKindCopy, isSiteConnectionKind } from '../connectionKindCopy'

describe('isSiteConnectionKind', () => {
    it('is true for both injected-provider kinds and false for WalletConnect', () => {
        expect(isSiteConnectionKind('dapp')).toBe(true)
        expect(isSiteConnectionKind('dapp-eip1193')).toBe(true)
        expect(isSiteConnectionKind('walletconnect-v1')).toBe(false)
        expect(isSiteConnectionKind('walletconnect-v2')).toBe(false)
    })
})

describe('connectionKindCopy', () => {
    it.each(['dapp', 'dapp-eip1193'] as const)(
        'gives %s the connected-sites copy and the globe',
        kind => {
            expect(connectionKindCopy(kind)).toEqual({
                badgeKey: 'settings.connections.badge_dapp',
                deleteTitleKey: 'settings.connected_sites.revoke_title',
                deleteBodyKey: 'settings.connected_sites.revoke_body',
                confirmKey: 'settings.connected_sites.revoke_confirm',
                cancelKey: 'settings.connected_sites.revoke_cancel',
                fallbackIcon: 'globe',
            })
        },
    )

    it.each(['walletconnect-v1', 'walletconnect-v2'] as const)(
        'gives %s the WalletConnect copy and icon',
        kind => {
            expect(connectionKindCopy(kind)).toEqual({
                badgeKey: 'settings.connections.badge_wallet_connect',
                deleteTitleKey: 'walletconnect.settings.delete_title',
                deleteBodyKey: 'walletconnect.settings.delete_body',
                confirmKey: 'common.delete.label',
                cancelKey: 'common.cancel.label',
                fallbackIcon: 'wallet-connect',
            })
        },
    )
})
