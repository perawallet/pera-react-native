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

import { formatFieldDiff } from '../diff'

describe('formatFieldDiff', () => {
    it('shows only differing fields, with both values', () => {
        const output = formatFieldDiff(
            { sender: 'AAA', amount: 1000n, fee: 1000n },
            { sender: 'AAA', amount: 999n, fee: 1000n },
        )

        expect(output).toContain('amount')
        expect(output).toContain('1000')
        expect(output).toContain('999')
        expect(output).not.toContain('sender')
    })

    it('renders byte fields as hex', () => {
        const output = formatFieldDiff(
            { note: new Uint8Array([1, 255]) },
            { note: new Uint8Array([1, 254]) },
        )

        expect(output).toContain('01ff')
        expect(output).toContain('01fe')
    })

    it('renders a declared field the transaction does not carry as unset', () => {
        const output = formatFieldDiff(
            { note: new Uint8Array([7]) },
            { note: undefined },
        )

        expect(output).toContain('note')
        expect(output).toContain('(unset)')
    })

    it('is empty when every declared field matches', () => {
        expect(
            formatFieldDiff(
                { amount: 5n, note: new Uint8Array([1]) },
                { amount: 5n, note: new Uint8Array([1]) },
            ),
        ).toBe('')
    })
})
