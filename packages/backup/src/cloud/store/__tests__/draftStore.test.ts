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
    useCloudBackupDraftStore,
    useCloudBackupRestoreDraftStore,
} from '../draftStore'

describe('useCloudBackupDraftStore', () => {
    beforeEach(() => {
        useCloudBackupDraftStore.getState().resetState()
        useCloudBackupRestoreDraftStore.getState().resetState()
    })

    it('stores and clears the draft set atomically', () => {
        useCloudBackupDraftStore
            .getState()
            .setDraft({ mnemonic: ['alpha', 'bravo'], salt: 'c2FsdA==' })
        expect(useCloudBackupDraftStore.getState().mnemonic).toEqual([
            'alpha',
            'bravo',
        ])
        expect(useCloudBackupDraftStore.getState().salt).toBe('c2FsdA==')

        useCloudBackupDraftStore.getState().clearDraft()
        expect(useCloudBackupDraftStore.getState().mnemonic).toBeNull()
        expect(useCloudBackupDraftStore.getState().salt).toBeNull()
    })

    it('keeps the setup and restore drafts fully isolated', () => {
        useCloudBackupDraftStore
            .getState()
            .setDraft({ mnemonic: ['generated'], salt: 'setup' })
        useCloudBackupRestoreDraftStore.getState().setMnemonic(['user-entered'])

        // Writing to one instance must never leak into the other.
        expect(useCloudBackupRestoreDraftStore.getState().mnemonic).toEqual([
            'user-entered',
        ])
        expect(useCloudBackupDraftStore.getState().mnemonic).toEqual([
            'generated',
        ])

        useCloudBackupRestoreDraftStore.getState().clearDraft()
        expect(useCloudBackupRestoreDraftStore.getState().mnemonic).toBeNull()
        // Clearing the restore draft leaves the setup draft untouched.
        expect(useCloudBackupDraftStore.getState().mnemonic).toEqual([
            'generated',
        ])
    })
})
