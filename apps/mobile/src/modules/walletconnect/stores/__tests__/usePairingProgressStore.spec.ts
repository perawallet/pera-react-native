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

import { describe, it, expect, beforeEach } from 'vitest'
import { usePairingProgressStore } from '../usePairingProgressStore'

describe('usePairingProgressStore', () => {
    beforeEach(() => {
        usePairingProgressStore.getState().resetState()
    })

    it('starts idle', () => {
        expect(usePairingProgressStore.getState().pendingCount).toBe(0)
    })

    it('counts overlapping pairings instead of toggling a flag', () => {
        const { beginPairing, endPairing } = usePairingProgressStore.getState()

        beginPairing()
        beginPairing()
        expect(usePairingProgressStore.getState().pendingCount).toBe(2)

        endPairing()
        expect(usePairingProgressStore.getState().pendingCount).toBe(1)
        endPairing()
        expect(usePairingProgressStore.getState().pendingCount).toBe(0)
    })

    it('never goes negative on unbalanced endPairing calls', () => {
        usePairingProgressStore.getState().endPairing()
        expect(usePairingProgressStore.getState().pendingCount).toBe(0)
    })
})
