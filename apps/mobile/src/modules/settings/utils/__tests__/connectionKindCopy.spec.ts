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
            const copy = connectionKindCopy(kind)

            expect(copy.deleteTitleKey).toBe(
                'settings.connected_sites.revoke_title',
            )
            expect(copy.confirmKey).toBe(
                'settings.connected_sites.revoke_confirm',
            )
            expect(copy.fallbackIcon).toBe('globe')
        },
    )

    it.each(['walletconnect-v1', 'walletconnect-v2'] as const)(
        'gives %s the WalletConnect copy and icon',
        kind => {
            const copy = connectionKindCopy(kind)

            expect(copy.deleteTitleKey).toBe(
                'walletconnect.settings.delete_title',
            )
            expect(copy.confirmKey).toBe('common.delete.label')
            expect(copy.fallbackIcon).toBe('wallet-connect')
        },
    )
})
