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

export type CloudBackupDraft = {
    mnemonicIndices: Uint16Array
    salt: string
}

type CloudBackupDraftState = BaseStoreState & {
    mnemonicIndices: Uint16Array | null
    salt: string | null
}

type CloudBackupDraftActions = {
    setDraft: (draft: CloudBackupDraft) => void
    clearDraft: () => void
}

export type CloudBackupDraftStore = CloudBackupDraftState &
    CloudBackupDraftActions

const initialDraftState = {
    mnemonicIndices: null as Uint16Array | null,
    salt: null as string | null,
}

/** Setup draft: the credentials we generate. */
export const useCloudBackupDraftStore = create<CloudBackupDraftStore>()((
    set,
    get,
) => {
    const clear = () => {
        zeroBytes(get().mnemonicIndices)
        set(initialDraftState)
    }

    return {
        ...initialDraftState,
        setDraft: ({ mnemonicIndices, salt }: CloudBackupDraft) => {
            // Copy, don't alias: the caller zeroes its own buffer on unmount.
            zeroBytes(get().mnemonicIndices)
            set({ mnemonicIndices: mnemonicIndices.slice(), salt })
        },
        clearDraft: clear,
        resetState: clear,
    }
})

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
    salt: string | null
}

type CloudBackupRestoreDraftActions = {
    setMnemonic: (mnemonic: string[]) => void
    setSalt: (salt: string) => void
    clearDraft: () => void
}

export type CloudBackupRestoreDraftStore = CloudBackupRestoreDraftState &
    CloudBackupRestoreDraftActions

const initialRestoreDraftState = {
    mnemonicIndices: null as Uint16Array | null,
    mnemonicRawBytes: null as Uint8Array | null,
    salt: null as string | null,
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
            setSalt: (salt: string) => set({ salt }),
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
