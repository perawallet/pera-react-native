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

import { describe, expect, it } from 'vitest'
import { containsQuantumSigner } from '../containsQuantumSigner'
import type { SignerInfo } from '../../types'

describe('containsQuantumSigner', () => {
    it('returns true when any signer is quantum', () => {
        const signers: SignerInfo[] = [
            { address: 'A', accountType: 'algo25' },
            { address: 'B', accountType: 'quantum' },
        ]
        expect(containsQuantumSigner(signers)).toBe(true)
    })

    it('returns false when no signer is quantum', () => {
        const signers: SignerInfo[] = [{ address: 'A', accountType: 'algo25' }]
        expect(containsQuantumSigner(signers)).toBe(false)
    })

    it('returns false for signers with no accountType', () => {
        expect(containsQuantumSigner([{ address: 'A' }])).toBe(false)
    })
})
