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

import { describe, expect, it, vi } from 'vitest'
import { translateIfKey } from '../translateIfKey'

const t = vi.fn((key: string) => `translated:${key}`)

describe('translateIfKey', () => {
    it('translates a title shaped like a key', () => {
        const title = 'signing.transactions.title_one'

        const result = translateIfKey(t, title)

        expect(result).toBe('translated:signing.transactions.title_one')
    })

    it('returns text with spaces as it is', () => {
        const title = 'Ledger Nano X.2'

        const result = translateIfKey(t, title)

        expect(result).toBe('Ledger Nano X.2')
    })

    it('returns text without a dot as it is', () => {
        const title = 'MyLedger'

        const result = translateIfKey(t, title)

        expect(result).toBe('MyLedger')
    })
})
