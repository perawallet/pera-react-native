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
import { mnemonicWordsToIndices } from '@perawallet/wallet-core-kms'
import {
    readCloudBackupDraftMnemonic,
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

    const REGISTRATION = () => ({
        backupId: 'did:pera:abc',
        deviceId: 'device-123',
        encryptionKey: Uint8Array.from([7, 7, 7]),
        authSecretKey: Uint8Array.from([8, 8, 8]),
    })

    const DRAFT_SALT = 'c2FsdA=='

    const seedDraft = () =>
        useCloudBackupDraftStore
            .getState()
            .setDraft({ mnemonicIndices: INDICES(), salt: DRAFT_SALT })

    it('retains the registration alongside the draft', () => {
        seedDraft()

        expect(
            useCloudBackupDraftStore
                .getState()
                .setRegistration(REGISTRATION(), DRAFT_SALT),
        ).toBe(true)

        expect(useCloudBackupDraftStore.getState().registration?.backupId).toBe(
            'did:pera:abc',
        )
        expect(useCloudBackupDraftStore.getState().registration?.deviceId).toBe(
            'device-123',
        )
    })

    // The user left while the registration was in flight, so nothing would
    // ever come back to zero these.
    it('refuses and zeroes a registration for a draft that is already gone', () => {
        const orphaned = REGISTRATION()

        expect(
            useCloudBackupDraftStore
                .getState()
                .setRegistration(orphaned, DRAFT_SALT),
        ).toBe(false)

        expect(useCloudBackupDraftStore.getState().registration).toBeNull()
        expect(Array.from(orphaned.encryptionKey)).toEqual([0, 0, 0])
        expect(Array.from(orphaned.authSecretKey)).toEqual([0, 0, 0])
    })

    it('zeroes the retained key buffers on clear', () => {
        seedDraft()
        useCloudBackupDraftStore
            .getState()
            .setRegistration(REGISTRATION(), DRAFT_SALT)
        const retained = useCloudBackupDraftStore.getState().registration!

        useCloudBackupDraftStore.getState().clearDraft()

        expect(Array.from(retained.encryptionKey)).toEqual([0, 0, 0])
        expect(Array.from(retained.authSecretKey)).toEqual([0, 0, 0])
        expect(useCloudBackupDraftStore.getState().registration).toBeNull()
    })

    it('drops and zeroes the registration when a new draft replaces it', () => {
        seedDraft()
        useCloudBackupDraftStore
            .getState()
            .setRegistration(REGISTRATION(), DRAFT_SALT)
        const replaced = useCloudBackupDraftStore.getState().registration!

        useCloudBackupDraftStore
            .getState()
            .setDraft({ mnemonicIndices: INDICES(), salt: 'second' })

        expect(Array.from(replaced.encryptionKey)).toEqual([0, 0, 0])
        expect(useCloudBackupDraftStore.getState().registration).toBeNull()
    })

    it('zeroes a replaced registration rather than orphaning its keys', () => {
        seedDraft()
        useCloudBackupDraftStore
            .getState()
            .setRegistration(REGISTRATION(), DRAFT_SALT)
        const replaced = useCloudBackupDraftStore.getState().registration!

        useCloudBackupDraftStore
            .getState()
            .setRegistration(REGISTRATION(), DRAFT_SALT)

        expect(Array.from(replaced.encryptionKey)).toEqual([0, 0, 0])
        expect(Array.from(replaced.authSecretKey)).toEqual([0, 0, 0])
        expect(
            Array.from(
                useCloudBackupDraftStore.getState().registration!.encryptionKey,
            ),
        ).toEqual([7, 7, 7])
    })

    // A registration derived under draft A landing after draft B replaced it
    // would otherwise pair A's backup id and keys with B's phrase and salt.
    it('refuses and zeroes a registration derived under a stale salt', () => {
        seedDraft()
        useCloudBackupDraftStore
            .getState()
            .setDraft({ mnemonicIndices: INDICES(), salt: 'second' })
        const current = { ...REGISTRATION(), backupId: 'did:pera:second' }
        useCloudBackupDraftStore.getState().setRegistration(current, 'second')

        const stale = REGISTRATION()

        expect(
            useCloudBackupDraftStore
                .getState()
                .setRegistration(stale, DRAFT_SALT),
        ).toBe(false)

        expect(Array.from(stale.encryptionKey)).toEqual([0, 0, 0])
        expect(Array.from(stale.authSecretKey)).toEqual([0, 0, 0])
        expect(useCloudBackupDraftStore.getState().registration).toBe(current)
        expect(Array.from(current.encryptionKey)).toEqual([7, 7, 7])
        expect(Array.from(current.authSecretKey)).toEqual([8, 8, 8])
    })

    it('reads the draft phrase back as words', () => {
        useCloudBackupDraftStore.getState().setDraft({
            mnemonicIndices: mnemonicWordsToIndices(['zebra', 'zoo'])!,
            salt: 'c2FsdA==',
        })

        expect(readCloudBackupDraftMnemonic()).toEqual(['zebra', 'zoo'])

        useCloudBackupDraftStore.getState().clearDraft()
        expect(readCloudBackupDraftMnemonic()).toBeNull()
    })
})
