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

import { beforeEach, describe, expect, it } from 'vitest'
import {
    clearPendingImportMnemonic,
    consumePendingImportMnemonic,
    setPendingImportMnemonic,
    usePendingImportMnemonicStore,
} from '../pendingImportMnemonic'

// Every token is a real wordlist word, so this takes the indexed path.
const VALID_MNEMONIC = new Array(24).fill('word').join(' ')
// Contains a non-wordlist token, so this falls back to raw UTF-8 bytes.
const RAW_MNEMONIC = 'notaword abandon ability'

describe('pendingImportMnemonic store', () => {
    beforeEach(() => {
        usePendingImportMnemonicStore.getState().resetState()
    })

    it('starts empty', () => {
        const state = usePendingImportMnemonicStore.getState()
        expect(state.pendingIndices).toBeNull()
        expect(state.pendingRawBytes).toBeNull()
    })

    it('set stores a valid phrase as wordlist indices, not raw bytes', () => {
        setPendingImportMnemonic(VALID_MNEMONIC)

        const state = usePendingImportMnemonicStore.getState()
        expect(state.pendingRawBytes).toBeNull()
        expect(ArrayBuffer.isView(state.pendingIndices!)).toBe(true)
        // Indices are 16-bit: 24 words → 48 bytes, far less than the UTF-8 phrase.
        expect(state.pendingIndices!.length).toBe(24)
    })

    it('retains no readable dictionary words for an indexed phrase', () => {
        setPendingImportMnemonic(VALID_MNEMONIC)

        const indices = usePendingImportMnemonicStore.getState().pendingIndices!
        const asBytes = new Uint8Array(
            indices.buffer,
            indices.byteOffset,
            indices.byteLength,
        )
        expect(new TextDecoder().decode(asBytes)).not.toContain('word')
    })

    it('set falls back to UTF-8 bytes when a token is not a wordlist word', () => {
        setPendingImportMnemonic(RAW_MNEMONIC)

        const state = usePendingImportMnemonicStore.getState()
        expect(state.pendingIndices).toBeNull()
        expect(ArrayBuffer.isView(state.pendingRawBytes!)).toBe(true)
        expect(new TextDecoder().decode(state.pendingRawBytes!)).toBe(
            RAW_MNEMONIC,
        )
    })

    it('consume round-trips an indexed phrase and clears the store', () => {
        setPendingImportMnemonic(VALID_MNEMONIC)

        expect(consumePendingImportMnemonic()).toBe(VALID_MNEMONIC)

        const state = usePendingImportMnemonicStore.getState()
        expect(state.pendingIndices).toBeNull()
        expect(state.pendingRawBytes).toBeNull()
    })

    it('consume round-trips a raw-fallback phrase and clears the store', () => {
        setPendingImportMnemonic(RAW_MNEMONIC)

        expect(consumePendingImportMnemonic()).toBe(RAW_MNEMONIC)

        const state = usePendingImportMnemonicStore.getState()
        expect(state.pendingIndices).toBeNull()
        expect(state.pendingRawBytes).toBeNull()
    })

    it('consume zeroes the indexed buffer the store held', () => {
        setPendingImportMnemonic(VALID_MNEMONIC)
        const retained =
            usePendingImportMnemonicStore.getState().pendingIndices!

        consumePendingImportMnemonic()

        expect(retained.every(value => value === 0)).toBe(true)
    })

    it('consume zeroes the raw buffer the store held', () => {
        setPendingImportMnemonic(RAW_MNEMONIC)
        const retained =
            usePendingImportMnemonicStore.getState().pendingRawBytes!

        consumePendingImportMnemonic()

        expect(retained.every(byte => byte === 0)).toBe(true)
    })

    it('set zeroes the previously-held buffer before overwriting it', () => {
        setPendingImportMnemonic(VALID_MNEMONIC)
        const retained =
            usePendingImportMnemonicStore.getState().pendingIndices!

        setPendingImportMnemonic(VALID_MNEMONIC)

        expect(retained.every(value => value === 0)).toBe(true)
    })

    it('set zeroes the previous buffer when switching indexed → raw', () => {
        setPendingImportMnemonic(VALID_MNEMONIC)
        const retained =
            usePendingImportMnemonicStore.getState().pendingIndices!

        setPendingImportMnemonic(RAW_MNEMONIC)

        expect(retained.every(value => value === 0)).toBe(true)
        expect(
            usePendingImportMnemonicStore.getState().pendingIndices,
        ).toBeNull()
    })

    it('consume returns null and stays cleared when nothing is pending', () => {
        expect(consumePendingImportMnemonic()).toBeNull()
        expect(consumePendingImportMnemonic()).toBeNull()
    })

    it('clear zeroes and removes a pending phrase without returning it', () => {
        setPendingImportMnemonic(VALID_MNEMONIC)
        const retained =
            usePendingImportMnemonicStore.getState().pendingIndices!

        clearPendingImportMnemonic()

        expect(retained.every(value => value === 0)).toBe(true)
        expect(
            usePendingImportMnemonicStore.getState().pendingIndices,
        ).toBeNull()
    })
})
