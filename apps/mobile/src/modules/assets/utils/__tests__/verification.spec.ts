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

import { describe, it, expect } from 'vitest'
import { getVerificationIcon } from '../verification'

describe('getVerificationIcon', () => {
    it.each([
        ['verified', 'assets/verified'],
        ['trusted', 'assets/trusted'],
        ['suspicious', 'assets/suspicious'],
    ])('maps the %s tier to its icon', (tier, icon) => {
        expect(getVerificationIcon(tier)).toBe(icon)
    })

    it('returns null for the unverified tier (no icon)', () => {
        expect(getVerificationIcon('unverified')).toBeNull()
    })

    it('returns null for an unknown tier', () => {
        expect(getVerificationIcon('something-else')).toBeNull()
    })
})
