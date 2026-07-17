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

// @vitest-environment node

import { describe, it, expect, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { getNextSharedAccountName } from '../getNextSharedAccountName'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    isMultisigAccount: (account: { type: string }) =>
        account.type === 'multisig',
}))

const acc = (type: string, address: string, name?: string): WalletAccount =>
    ({ type, address, name }) as unknown as WalletAccount

const BASE = 'Shared Account'

describe('getNextSharedAccountName', () => {
    it('returns "#1" when the wallet has no shared accounts', () => {
        expect(getNextSharedAccountName([], BASE)).toBe('Shared Account #1')
    })

    it('numbers the next account after the count of existing multisig accounts', () => {
        const accounts = [
            acc('multisig', 'M1', 'First'),
            acc('algo25', 'A1', 'Standard'),
            acc('multisig', 'M2', 'Second'),
        ]
        expect(getNextSharedAccountName(accounts, BASE)).toBe(
            'Shared Account #3',
        )
    })

    it('skips a number whose default name is already taken', () => {
        const accounts = [acc('multisig', 'M1', 'Shared Account #2')]
        expect(getNextSharedAccountName(accounts, BASE)).toBe(
            'Shared Account #3',
        )
    })

    it('matches taken names case-insensitively', () => {
        const accounts = [acc('algo25', 'A1', 'shared account #1')]
        expect(getNextSharedAccountName(accounts, BASE)).toBe(
            'Shared Account #2',
        )
    })

    it('ignores the excluded account when counting and checking names', () => {
        const accounts = [
            acc('multisig', 'M1', 'Shared Account #1'),
            acc('multisig', 'M2', 'Shared Account #2'),
        ]
        expect(getNextSharedAccountName(accounts, BASE, 'M2')).toBe(
            'Shared Account #2',
        )
    })
})
