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

import { describe, test, expect } from 'vitest'
import { mnemonicIndexToWord } from '@perawallet/wallet-core-kms'
import { render, screen } from '@test-utils/render'
import { PassphraseGrid } from '../PassphraseGrid'

// Position 2 and position 5 share an index: a repeated word has to render at
// both of its positions rather than collapsing on a duplicate React key.
const INDICES = Uint16Array.from([412, 1337, 88, 7, 1337, 601])

describe('PassphraseGrid', () => {
    test('numbers every word from 1 through the phrase length', () => {
        render(<PassphraseGrid wordIndices={INDICES} />)

        for (let position = 1; position <= INDICES.length; position++) {
            expect(screen.getByText(String(position))).toBeTruthy()
        }
        expect(screen.queryByText(String(INDICES.length + 1))).toBeNull()
    })

    test('resolves each index to its wordlist word, repeats included', () => {
        render(<PassphraseGrid wordIndices={INDICES} />)

        expect(screen.getAllByText(mnemonicIndexToWord(1337))).toHaveLength(2)
        expect(screen.getByText(mnemonicIndexToWord(412))).toBeTruthy()
        expect(screen.getByText(mnemonicIndexToWord(601))).toBeTruthy()
    })

    test('renders nothing when the buffer is absent', () => {
        render(<PassphraseGrid wordIndices={null} />)

        expect(screen.queryByText('1')).toBeNull()
    })
})
