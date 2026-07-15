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

import { describe, test, expect, beforeEach } from 'vitest'
import { useHDImportSessionStore } from '../store'

const sample = () => ({
    walletKeyId: 'w-1',
    rootKey: new Uint8Array(96).fill(7),
    entropy: new Uint8Array(32).fill(3),
    derivationType: 9 as const,
})

describe('useHDImportSessionStore', () => {
    beforeEach(() => {
        useHDImportSessionStore.getState().resetState()
    })

    test('starts empty', () => {
        expect(useHDImportSessionStore.getState().pending).toBeNull()
    })

    test('start() sets the pending session', () => {
        const s = sample()
        useHDImportSessionStore.getState().start(s)
        expect(useHDImportSessionStore.getState().pending).toEqual(s)
    })

    test('resetState() zeroes the in-memory bytes and unsets pending', () => {
        const s = sample()
        useHDImportSessionStore.getState().start(s)
        const ref = useHDImportSessionStore.getState().pending!
        useHDImportSessionStore.getState().resetState()
        expect(useHDImportSessionStore.getState().pending).toBeNull()
        // The buffers we handed in were taken by reference; after resetState()
        // they should be zeroed so any leaked reference is safe.
        expect(Array.from(ref.rootKey).every(b => b === 0)).toBe(true)
        expect(Array.from(ref.entropy).every(b => b === 0)).toBe(true)
    })

    test('start() while another is pending replaces it and zeroes the old one', () => {
        const a = sample()
        useHDImportSessionStore.getState().start(a)
        const oldRef = useHDImportSessionStore.getState().pending!

        const b = {
            walletKeyId: 'w-2',
            rootKey: new Uint8Array(96).fill(8),
            entropy: new Uint8Array(32).fill(4),
            derivationType: 9 as const,
        }
        useHDImportSessionStore.getState().start(b)

        expect(useHDImportSessionStore.getState().pending?.walletKeyId).toBe(
            'w-2',
        )
        expect(Array.from(oldRef.rootKey).every(byte => byte === 0)).toBe(true)
        expect(Array.from(oldRef.entropy).every(byte => byte === 0)).toBe(true)
    })
})
