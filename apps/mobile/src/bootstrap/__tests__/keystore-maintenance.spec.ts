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
import { derivePQKeygenSeed } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { keystoreMaintenanceDependencies } from '../keystore-maintenance'

vi.mock('@perawallet/wallet-core-chain-algorand/blockchain', () => ({
    derivePQKeygenSeed: vi.fn(),
}))

describe('keystoreMaintenanceDependencies', () => {
    it("hands keystore maintenance Algorand's post-quantum keygen seed derivation", () => {
        expect(keystoreMaintenanceDependencies.deriveKeygenSeed).toBe(
            derivePQKeygenSeed,
        )
    })
})
