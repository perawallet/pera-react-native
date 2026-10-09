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
import { accountForType } from '@test-utils/accountCustody'
import { holdsQuantumKey } from '../quantumKey'

describe('holdsQuantumKey', () => {
    it('is true only for a local account on the quantum seed', () => {
        expect(holdsQuantumKey(accountForType('quantum'))).toBe(true)
        for (const kind of [
            'algo25',
            'hdWallet',
            'hardware',
            'multisig',
            'watch',
        ] as const) {
            expect(holdsQuantumKey(accountForType(kind))).toBe(false)
        }
    })
})
