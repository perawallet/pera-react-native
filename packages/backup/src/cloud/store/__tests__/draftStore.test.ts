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
    useCloudBackupDraftStore,
    useCloudBackupRestoreDraftStore,
} from '../draftStore'

const INDICES = () => Uint16Array.from([1, 2, 3])

describe('useCloudBackupDraftStore', () => {
    beforeEach(() => {
        useCloudBackupDraftStore.getState().resetState()
        useCloudBackupRestoreDraftStore.getState().resetState()
    })

    it('stores and clears the draft set atomically', () => {
        useCloudBackupDraftStore
            .getState()
            .setDraft({ mnemonicIndices: INDICES(), salt: 'c2FsdA==' })
        expect(
            Array.from(useCloudBackupDraftStore.getState().mnemonicIndices!),
        ).toEqual([1, 2, 3])
        expect(useCloudBackupDraftStore.getState().salt).toBe('c2FsdA==')

        useCloudBackupDraftStore.getState().clearDraft()
        expect(useCloudBackupDraftStore.getState().mnemonicIndices).toBeNull()
        expect(useCloudBackupDraftStore.getState().salt).toBeNull()
    })

    it('keeps its own copy so the caller can zero its buffer independently', () => {
        const callerBuffer = INDICES()
        useCloudBackupDraftStore
            .getState()
            .setDraft({ mnemonicIndices: callerBuffer, salt: 'setup' })

        callerBuffer.fill(0)

        expect(
            Array.from(useCloudBackupDraftStore.getState().mnemonicIndices!),
        ).toEqual([1, 2, 3])
    })

    it('zeroes the retained buffer on clear rather than only dropping it', () => {
        useCloudBackupDraftStore
            .getState()
            .setDraft({ mnemonicIndices: INDICES(), salt: 'setup' })
        const retained = useCloudBackupDraftStore.getState().mnemonicIndices!

        useCloudBackupDraftStore.getState().clearDraft()

        expect(Array.from(retained)).toEqual([0, 0, 0])
    })

    it('zeroes the previous draft when a new one replaces it', () => {
        useCloudBackupDraftStore
            .getState()
            .setDraft({ mnemonicIndices: INDICES(), salt: 'first' })
        const replaced = useCloudBackupDraftStore.getState().mnemonicIndices!

        useCloudBackupDraftStore.getState().setDraft({
            mnemonicIndices: Uint16Array.from([9]),
            salt: 'second',
        })

        expect(Array.from(replaced)).toEqual([0, 0, 0])
        expect(
            Array.from(useCloudBackupDraftStore.getState().mnemonicIndices!),
        ).toEqual([9])
    })

    it('keeps the setup and restore drafts fully isolated', () => {
        useCloudBackupDraftStore
            .getState()
            .setDraft({ mnemonicIndices: INDICES(), salt: 'setup' })
        useCloudBackupRestoreDraftStore.getState().setMnemonic(['zebra'])

        expect(readCloudBackupRestoreMnemonic()).toEqual(['zebra'])
        expect(
            Array.from(useCloudBackupDraftStore.getState().mnemonicIndices!),
        ).toEqual([1, 2, 3])

        useCloudBackupRestoreDraftStore.getState().clearDraft()
        expect(readCloudBackupRestoreMnemonic()).toBeNull()
        expect(
            Array.from(useCloudBackupDraftStore.getState().mnemonicIndices!),
        ).toEqual([1, 2, 3])
    })
})
