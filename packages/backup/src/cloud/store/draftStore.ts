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

import { create } from 'zustand'
import {
    mnemonicIndexToWord,
    mnemonicWordsToIndices,
    zeroBytes,
} from '@perawallet/wallet-core-kms'
import { registerStore } from '@perawallet/wallet-core-shared'
import type { BaseStoreState } from '@perawallet/wallet-core-shared'
import type { BackupId, DeviceId } from '../models'
import type { BackupEncryptionKey } from '../credentials/backupCredentialsFile'

export type CloudBackupDraft = {
    mnemonicIndices: Uint16Array
    salt: string
}

export type CloudBackupRegistration = {
    backupId: BackupId
    /** Pinned to the attempt: the backup exists server-side under this device. */
    deviceId: DeviceId
    encryptionKey: Uint8Array
    authSecretKey: Uint8Array
}

type CloudBackupDraftState = BaseStoreState & {
    mnemonicIndices: Uint16Array | null
    salt: string | null
    registration: CloudBackupRegistration | null
}

type CloudBackupDraftActions = {
    setDraft: (draft: CloudBackupDraft) => void
    /** `salt` is the one the registration was derived under. `false` when it is
     *  not the held draft's — the keys are zeroed and dropped rather than
     *  retained, so the caller must treat it as a failure. */
    setRegistration: (
        registration: CloudBackupRegistration,
        salt: string,
    ) => boolean
    clearDraft: () => void
}

export type CloudBackupDraftStore = CloudBackupDraftState &
    CloudBackupDraftActions

const initialDraftState = {
    mnemonicIndices: null as Uint16Array | null,
    salt: null as string | null,
    registration: null as CloudBackupRegistration | null,
}

/** Setup draft: the credentials we generate. */
export const useCloudBackupDraftStore = create<CloudBackupDraftStore>()((
    set,
    get,
) => {
    const zeroRetained = () => {
        const { mnemonicIndices, registration } = get()
        zeroBytes(
            mnemonicIndices,
            registration?.encryptionKey,
            registration?.authSecretKey,
        )
    }

    const clear = () => {
        zeroRetained()
        set(initialDraftState)
    }

    return {
        ...initialDraftState,
        setDraft: ({ mnemonicIndices, salt }: CloudBackupDraft) => {
            // Copy, don't alias: the caller zeroes its own buffer on unmount.
            // A new phrase means a new backup id, so any registration held for
            // the old one goes with it.
            zeroRetained()
            set({
                mnemonicIndices: mnemonicIndices.slice(),
                salt,
                registration: null,
            })
        },
        setRegistration: (
            registration: CloudBackupRegistration,
            salt: string,
        ) => {
            const {
                mnemonicIndices,
                salt: draftSalt,
                registration: previous,
            } = get()
            // Salt is per-draft CSRNG, so it identifies the draft these keys
            // were derived under. A mismatch means that draft is gone or
            // replaced: retaining them would pair its backup id with another
            // draft's phrase, and nothing would ever zero them.
            if (!mnemonicIndices || draftSalt !== salt) {
                zeroBytes(
                    registration.encryptionKey,
                    registration.authSecretKey,
                )
                return false
            }
            // Every write path that drops key buffers scrubs them first; a
            // re-register would otherwise orphan the last attempt's keys.
            if (previous && previous !== registration) {
                zeroBytes(previous.encryptionKey, previous.authSecretKey)
            }
            set({ registration })
            return true
        },
        clearDraft: clear,
        resetState: clear,
    }
})

/** Words live only for the caller's turn; the retained form stays the zeroable
 *  index buffer in the store. */
export const readCloudBackupDraftMnemonic = (): string[] | null => {
    const { mnemonicIndices } = useCloudBackupDraftStore.getState()
    if (!mnemonicIndices) return null
    return Array.from(mnemonicIndices, index => mnemonicIndexToWord(index))
}

registerStore({
    name: 'cloud-backup-draft-store',
    clearStorage: () => useCloudBackupDraftStore.getState().resetState(),
    resetState: () => useCloudBackupDraftStore.getState().resetState(),
})

type CloudBackupRestoreDraftState = BaseStoreState & {
    /** Wordlist indices, when every entered token is a wordlist word. */
    mnemonicIndices: Uint16Array | null
    /** UTF-8 fallback for an entry containing a non-wordlist token. */
    mnemonicRawBytes: Uint8Array | null
    /**
     * The key read out of a saved credentials file, carried from the options
     * sheet to the encryption-key screen. Here rather than in route params so
     * it never enters the navigation state tree.
     */
    importedKey: BackupEncryptionKey | null
}

type CloudBackupRestoreDraftActions = {
    setMnemonic: (mnemonic: string[]) => void
    setImportedKey: (importedKey: BackupEncryptionKey) => void
    clearDraft: () => void
}

export type CloudBackupRestoreDraftStore = CloudBackupRestoreDraftState &
    CloudBackupRestoreDraftActions

const initialRestoreDraftState = {
    mnemonicIndices: null as Uint16Array | null,
    mnemonicRawBytes: null as Uint8Array | null,
    importedKey: null as BackupEncryptionKey | null,
}

/**
 * Restore draft: the phrase the user types, so unvalidated. The raw-bytes
 * fallback is deliberate — preserving exactly what was typed lets the server
 * answer NOT_FOUND vs INVALID_CREDENTIALS instead of us rejecting locally.
 * Shape follows `pendingImportMnemonic` in `@perawallet/wallet-core-accounts`.
 */
export const useCloudBackupRestoreDraftStore =
    create<CloudBackupRestoreDraftStore>()((set, get) => {
        const clear = () => {
            const { mnemonicIndices, mnemonicRawBytes } = get()
            zeroBytes(mnemonicIndices, mnemonicRawBytes)
            set(initialRestoreDraftState)
        }

        return {
            ...initialRestoreDraftState,
            setMnemonic: (mnemonic: string[]) => {
                const indices = mnemonicWordsToIndices(mnemonic)
                const { mnemonicIndices, mnemonicRawBytes } = get()
                zeroBytes(mnemonicIndices, mnemonicRawBytes)
                set(
                    indices
                        ? { mnemonicIndices: indices, mnemonicRawBytes: null }
                        : {
                              mnemonicIndices: null,
                              mnemonicRawBytes: new TextEncoder().encode(
                                  mnemonic.join(' '),
                              ),
                          },
                )
            },
            setImportedKey: (importedKey: BackupEncryptionKey) =>
                set({ importedKey }),
            clearDraft: clear,
            resetState: clear,
        }
    })

/**
 * Leaves the retained buffer intact so a rejected attempt can be retried with a
 * different encryption key; `clearDraft` is what zeroes it.
 */
export const readCloudBackupRestoreMnemonic = (): string[] | null => {
    const { mnemonicIndices, mnemonicRawBytes } =
        useCloudBackupRestoreDraftStore.getState()

    if (mnemonicIndices) {
        return Array.from(mnemonicIndices, index => mnemonicIndexToWord(index))
    }
    if (mnemonicRawBytes) {
        return new TextDecoder().decode(mnemonicRawBytes).split(' ')
    }
    return null
}

registerStore({
    name: 'cloud-backup-restore-draft-store',
    clearStorage: () => useCloudBackupRestoreDraftStore.getState().resetState(),
    resetState: () => useCloudBackupRestoreDraftStore.getState().resetState(),
})
