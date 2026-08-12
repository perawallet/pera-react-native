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

import { describe, test, expect } from 'vitest'
import { createEmptySyncState } from '../syncState'

describe('createEmptySyncState', () => {
    test('initializes sync + result pointers as null', () => {
        const state = createEmptySyncState('did:pera:abc')

        expect(state.backupId).toBe('did:pera:abc')
        expect(state.lastSyncedSeq).toBe(0)
        expect(state.lastKnownBackupHash).toBeNull()
        expect(state.lastSyncedAt).toBeNull()
        expect(state.lastSyncResult).toBeNull()
        expect(state.items).toEqual({})
    })
})
