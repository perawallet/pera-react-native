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
import { reportUnresolvableAccountKeys } from '../utils/reportUnresolvableAccountKeys'

describe('reportUnresolvableAccountKeys', () => {
    it('returns accounts whose keyPairId has no keystore record', () => {
        const orphans = reportUnresolvableAccountKeys({
            accounts: [
                { id: 'a', keyPairId: 'key-1' },
                { id: 'b', keyPairId: 'key-2' },
            ],
            keyIds: new Set(['key-1']),
        })

        expect(orphans).toEqual(['b'])
    })

    it('ignores accounts that hold no key at all', () => {
        const orphans = reportUnresolvableAccountKeys({
            accounts: [{ id: 'watch-only' }],
            keyIds: new Set(),
        })

        expect(orphans).toEqual([])
    })
})
