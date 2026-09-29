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

import { describe, expect, it, vi } from 'vitest'

vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    return {
        MATERIAL_PREFIX: driver.MATERIAL_PREFIX,
        METADATA_PREFIX: driver.METADATA_PREFIX,
    }
})

import { isFlatCandidate, MIGRATIONS_LEDGER_KEY } from '../flatCandidate'
import { LAYOUT_VERSION_KEY } from '../preflight/0003-remove-layout-version-stamp'

describe('isFlatCandidate', () => {
    it('accepts a bare id, including one that is itself base64', () => {
        expect(isFlatCandidate('cred-1')).toBe(true)
        expect(
            isFlatCandidate('swdyhOn0NVGTv+haYcAHIPsCSudyr56t6oEFNeIaim0='),
        ).toBe(true)
    })

    it('rejects the split buckets, the ledger and the retired layout stamp', () => {
        expect(isFlatCandidate('k/cred-1')).toBe(false)
        expect(isFlatCandidate('m/cred-1')).toBe(false)
        expect(isFlatCandidate(MIGRATIONS_LEDGER_KEY)).toBe(false)
        expect(isFlatCandidate(LAYOUT_VERSION_KEY)).toBe(false)
    })
})
