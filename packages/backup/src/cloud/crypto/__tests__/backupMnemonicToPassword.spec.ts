/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { backupMnemonicToPassword } from '../backupMnemonicToPassword'

describe('backupMnemonicToPassword', () => {
    test('encodes the space-joined mnemonic as UTF-8 bytes', () => {
        const password = backupMnemonicToPassword([
            'abandon',
            'ability',
            'able',
        ])

        expect(password).toEqual(
            new TextEncoder().encode('abandon ability able'),
        )
    })

    test('applies NFKD normalization before encoding', () => {
        const password = backupMnemonicToPassword(['ﬁx'])

        expect(password).toEqual(new TextEncoder().encode('fix'))
    })
})
