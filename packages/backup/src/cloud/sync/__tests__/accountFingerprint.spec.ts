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

import { describe, expect, it } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { accountFingerprint } from '../accountFingerprint'

const account = (over: Partial<WalletAccount>): WalletAccount =>
    ({ address: 'A', type: 'watch', ...over }) as WalletAccount

describe('accountFingerprint', () => {
    it('changes when an account is added', () => {
        const before = accountFingerprint([account({ address: 'A' })])
        const after = accountFingerprint([
            account({ address: 'A' }),
            account({ address: 'B' }),
        ])
        expect(after).not.toBe(before)
    })

    it('changes when an account is renamed', () => {
        expect(accountFingerprint([account({ name: 'Old' })])).not.toBe(
            accountFingerprint([account({ name: 'New' })]),
        )
    })

    it('changes when an account is removed', () => {
        expect(accountFingerprint([account({ address: 'A' })])).not.toBe(
            accountFingerprint([]),
        )
    })

    it('ignores order, so a reorder is not a backup change', () => {
        const a = account({ address: 'A' })
        const b = account({ address: 'B' })
        expect(accountFingerprint([a, b])).toBe(accountFingerprint([b, a]))
    })

    it('ignores fields the backup address payload does not carry', () => {
        expect(accountFingerprint([account({ rekeyAddress: 'AUTH' })])).toBe(
            accountFingerprint([account({})]),
        )
    })

    it('does not collide when a name contains the field separator', () => {
        expect(
            accountFingerprint([account({ address: 'A', name: 'x B' })]),
        ).not.toBe(
            accountFingerprint([
                account({ address: 'A', name: 'x' }),
                account({ address: 'B' }),
            ]),
        )
    })
})
