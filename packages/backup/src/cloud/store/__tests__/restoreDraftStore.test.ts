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

import { describe, expect, it, beforeEach } from 'vitest'
import {
    readCloudBackupRestoreMnemonic,
    useCloudBackupRestoreDraftStore,
} from '../draftStore'

// Real wordlist words (indices 56 / 218) so a zeroed buffer is distinguishable
// from a stored one; 'bravvo' is the typo that forces the raw-bytes fallback.
const WORDLIST_PHRASE = ['alpha', 'brave']
const PHRASE_WITH_TYPO = ['alpha', 'bravvo']

describe('useCloudBackupRestoreDraftStore', () => {
    beforeEach(() => useCloudBackupRestoreDraftStore.getState().resetState())

    it('stores and clears mnemonic + salt', () => {
        useCloudBackupRestoreDraftStore.getState().setMnemonic(WORDLIST_PHRASE)
        useCloudBackupRestoreDraftStore.getState().setSalt('c2FsdA==')

        expect(readCloudBackupRestoreMnemonic()).toEqual(WORDLIST_PHRASE)
        expect(useCloudBackupRestoreDraftStore.getState().salt).toBe('c2FsdA==')

        useCloudBackupRestoreDraftStore.getState().clearDraft()
        expect(readCloudBackupRestoreMnemonic()).toBeNull()
        expect(useCloudBackupRestoreDraftStore.getState().salt).toBeNull()
    })

    it('starts empty', () => {
        expect(readCloudBackupRestoreMnemonic()).toBeNull()
        expect(useCloudBackupRestoreDraftStore.getState().salt).toBeNull()
    })

    it('retains a wordlist phrase as indices, never as words', () => {
        useCloudBackupRestoreDraftStore.getState().setMnemonic(WORDLIST_PHRASE)

        const { mnemonicIndices, mnemonicRawBytes } =
            useCloudBackupRestoreDraftStore.getState()
        expect(Array.from(mnemonicIndices!)).toEqual([56, 218])
        expect(mnemonicRawBytes).toBeNull()
    })

    it('falls back to UTF-8 bytes for a phrase with a non-wordlist token', () => {
        useCloudBackupRestoreDraftStore.getState().setMnemonic(PHRASE_WITH_TYPO)

        const { mnemonicIndices, mnemonicRawBytes } =
            useCloudBackupRestoreDraftStore.getState()
        expect(mnemonicIndices).toBeNull()
        expect(mnemonicRawBytes).not.toBeNull()
        expect(readCloudBackupRestoreMnemonic()).toEqual(PHRASE_WITH_TYPO)
    })

    it('zeroes the retained buffer on clear rather than only dropping it', () => {
        useCloudBackupRestoreDraftStore.getState().setMnemonic(WORDLIST_PHRASE)
        const retained =
            useCloudBackupRestoreDraftStore.getState().mnemonicIndices!

        useCloudBackupRestoreDraftStore.getState().clearDraft()

        expect(Array.from(retained)).toEqual([0, 0])
    })

    it('zeroes the previous entry when a new one replaces it, across shapes', () => {
        useCloudBackupRestoreDraftStore.getState().setMnemonic(WORDLIST_PHRASE)
        const replacedIndices =
            useCloudBackupRestoreDraftStore.getState().mnemonicIndices!

        useCloudBackupRestoreDraftStore.getState().setMnemonic(PHRASE_WITH_TYPO)
        const replacedBytes =
            useCloudBackupRestoreDraftStore.getState().mnemonicRawBytes!

        expect(Array.from(replacedIndices)).toEqual([0, 0])

        useCloudBackupRestoreDraftStore.getState().setMnemonic(WORDLIST_PHRASE)

        expect(replacedBytes.every(byte => byte === 0)).toBe(true)
    })
})
