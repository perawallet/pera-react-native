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

import { describe, expect, test } from 'vitest'
import { buildLedgerAccountPath } from '../path'

describe('buildLedgerAccountPath', () => {
    test('builds the m/-prefixed Algorand BIP-44 path with the given account index', () => {
        // `@algorandfoundation/ledger-algorand-js` serializePath (used by
        // signData) requires the canonical "m/"-prefixed BIP-32 form.
        expect(buildLedgerAccountPath(0)).toBe("m/44'/283'/0'/0/0")
        expect(buildLedgerAccountPath(5)).toBe("m/44'/283'/5'/0/0")
    })
})
