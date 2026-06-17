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

import { beforeEach, describe, expect, it } from 'vitest'
import {
    clearPendingImportMnemonic,
    consumePendingImportMnemonic,
    setPendingImportMnemonic,
    usePendingImportMnemonicStore,
} from '../pendingImportMnemonic'

const MNEMONIC = new Array(24).fill('word').join(' ')

describe('pendingImportMnemonic store', () => {
    beforeEach(() => {
        usePendingImportMnemonicStore.getState().resetState()
    })

    it('starts empty', () => {
        expect(
            usePendingImportMnemonicStore.getState().pendingMnemonicBytes,
        ).toBeNull()
    })

    it('set stores the mnemonic as UTF-8 bytes', () => {
        setPendingImportMnemonic(MNEMONIC)

        const bytes =
            usePendingImportMnemonicStore.getState().pendingMnemonicBytes
        // `instanceof Uint8Array` is unreliable here — TextEncoder may return a
        // Uint8Array from a different realm than the test global — so assert on
        // the byte-view-ness and the decoded contents instead.
        expect(ArrayBuffer.isView(bytes!)).toBe(true)
        expect(new TextDecoder().decode(bytes!)).toBe(MNEMONIC)
    })

    it('consume returns the mnemonic and clears the store in the same call', () => {
        setPendingImportMnemonic(MNEMONIC)

        const consumed = consumePendingImportMnemonic()

        expect(consumed).toBe(MNEMONIC)
        // Cleared immediately so the secret does not linger in the store.
        expect(
            usePendingImportMnemonicStore.getState().pendingMnemonicBytes,
        ).toBeNull()
    })

    it('consume zeroes the buffer the store held (not just drops the reference)', () => {
        setPendingImportMnemonic(MNEMONIC)
        // Hold a reference to the very buffer the store retains.
        const retained =
            usePendingImportMnemonicStore.getState().pendingMnemonicBytes!

        consumePendingImportMnemonic()

        // The decoded value was handed back, but the retained bytes are wiped.
        expect(retained.every(b => b === 0)).toBe(true)
    })

    it('consume returns null and stays cleared when nothing is pending', () => {
        expect(consumePendingImportMnemonic()).toBeNull()
        expect(consumePendingImportMnemonic()).toBeNull()
    })

    it('clear zeroes and removes a pending mnemonic without returning it', () => {
        setPendingImportMnemonic(MNEMONIC)
        const retained =
            usePendingImportMnemonicStore.getState().pendingMnemonicBytes!

        clearPendingImportMnemonic()

        expect(retained.every(b => b === 0)).toBe(true)
        expect(
            usePendingImportMnemonicStore.getState().pendingMnemonicBytes,
        ).toBeNull()
    })
})
