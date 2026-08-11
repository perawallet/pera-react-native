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
import { useCloudBackupRestoreDraftStore } from '../draftStore'

describe('useCloudBackupRestoreDraftStore', () => {
    beforeEach(() => useCloudBackupRestoreDraftStore.getState().resetState())

    it('stores and clears mnemonic + salt', () => {
        useCloudBackupRestoreDraftStore
            .getState()
            .setMnemonic(['alpha', 'bravo'])
        useCloudBackupRestoreDraftStore.getState().setSalt('c2FsdA==')
        expect(useCloudBackupRestoreDraftStore.getState().mnemonic).toEqual([
            'alpha',
            'bravo',
        ])
        expect(useCloudBackupRestoreDraftStore.getState().salt).toBe('c2FsdA==')

        useCloudBackupRestoreDraftStore.getState().clearDraft()
        expect(useCloudBackupRestoreDraftStore.getState().mnemonic).toBeNull()
        expect(useCloudBackupRestoreDraftStore.getState().salt).toBeNull()
    })

    it('starts empty', () => {
        expect(useCloudBackupRestoreDraftStore.getState().mnemonic).toBeNull()
        expect(useCloudBackupRestoreDraftStore.getState().salt).toBeNull()
    })
})
