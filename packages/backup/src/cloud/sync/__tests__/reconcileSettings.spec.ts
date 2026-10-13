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

import { describe, expect, it } from 'vitest'
import {
    BackupItemStatus,
    BackupItemType,
    SETTINGS_ITEM_ID,
    createEmptySyncState,
    settingsItemKey,
} from '../../models'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import { reconcileLocalSettings, reconcileSettings } from '../reconcileSettings'
import { TEST_SETTINGS } from './testSettings'

const KEY = 'settings/S'

/** As the server left it after the last push. */
const synced = () => {
    const state = reconcileSettings(
        createEmptySyncState('b'),
        KEY,
        TEST_SETTINGS,
        1,
    )
    state.items[KEY] = { ...state.items[KEY], isDirty: false, knownVer: 2 }
    return state
}

describe('reconcileSettings', () => {
    it('tracks a first sighting as a new, dirty item', () => {
        const next = reconcileSettings(
            createEmptySyncState('b'),
            KEY,
            TEST_SETTINGS,
            100,
        )

        expect(next.items[KEY]).toMatchObject({
            type: BackupItemType.SETTINGS,
            knownVer: 0,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
        })
        expect(next.items[KEY].localContentHash).toEqual(expect.any(String))
    })

    it('leaves a synced item clean when nothing changed', () => {
        const next = reconcileSettings(synced(), KEY, TEST_SETTINGS, 100)

        expect(next.items[KEY].isDirty).toBe(false)
    })

    it('marks the item dirty on an edit', () => {
        const next = reconcileSettings(
            synced(),
            KEY,
            { ...TEST_SETTINGS, confirmationMode: 'tap' },
            100,
        )

        expect(next.items[KEY].isDirty).toBe(true)
        expect(next.items[KEY].settingsFields?.confirmationMode).toMatchObject({
            value: 'tap',
            updatedAt: 100,
        })
    })

    it('leaves an item the server deleted alone', () => {
        const state = synced()
        state.items[KEY] = {
            ...state.items[KEY],
            status: BackupItemStatus.IGNORED,
        }

        const next = reconcileSettings(
            state,
            KEY,
            { ...TEST_SETTINGS, language: 'tr' },
            100,
        )

        expect(next).toBe(state)
    })
})

describe('reconcileLocalSettings', () => {
    it('files the settings under the hashed fixed id', () => {
        const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

        const next = reconcileLocalSettings(
            createEmptySyncState('b'),
            { hashAddress, getSettings: () => TEST_SETTINGS },
            100,
        )

        expect(Object.keys(next.items)).toEqual([
            settingsItemKey(hashAddress(SETTINGS_ITEM_ID)),
        ])
    })
})
