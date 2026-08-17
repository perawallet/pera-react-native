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

import { describe, expect, it } from 'vitest'
import {
    createKeyStore,
    FALCON_ALGORITHM,
    withSubtleFalcon1024,
} from '@algorandfoundation/keystore-core'

// Guards the premise of the whole migration: that the official library ships a
// Falcon generator we can hand custody to. If this fails, the quantum tasks are
// not buildable and the bump should stop at Task 3.
describe('keystore-core Falcon surface', () => {
    it('advertises Falcon-1024 as a shim-able algorithm', () => {
        expect(FALCON_ALGORITHM).toBe('Falcon-1024')
        expect(typeof withSubtleFalcon1024).toBe('function')
        expect(typeof createKeyStore).toBe('function')
    })
})
