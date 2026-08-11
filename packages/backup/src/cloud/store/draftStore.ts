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
import { registerStore } from '@perawallet/wallet-core-shared'
import type { BaseStoreState } from '@perawallet/wallet-core-shared'

export type CloudBackupDraft = {
    mnemonic: string[]
    salt: string
}

type CloudBackupDraftState = BaseStoreState & {
    mnemonic: string[] | null
    salt: string | null
}

type CloudBackupDraftActions = {
    setDraft: (draft: CloudBackupDraft) => void
    setMnemonic: (mnemonic: string[]) => void
    setSalt: (salt: string) => void
    clearDraft: () => void
}

export type CloudBackupDraftStore = CloudBackupDraftState &
    CloudBackupDraftActions

const initialState = {
    mnemonic: null as string[] | null,
    salt: null as string | null,
}

const createCloudBackupDraftStore = (storeName: string) => {
    const useStore = create<CloudBackupDraftStore>()(set => ({
        ...initialState,
        setDraft: ({ mnemonic, salt }: CloudBackupDraft) =>
            set({ mnemonic, salt }),
        setMnemonic: (mnemonic: string[]) => set({ mnemonic }),
        setSalt: (salt: string) => set({ salt }),
        clearDraft: () => set(initialState),
        resetState: () => set(initialState),
    }))

    registerStore({
        name: storeName,
        clearStorage: () => useStore.getState().resetState(),
        resetState: () => useStore.getState().resetState(),
    })

    return useStore
}

export const useCloudBackupDraftStore = createCloudBackupDraftStore(
    'cloud-backup-draft-store',
)

export const useCloudBackupRestoreDraftStore = createCloudBackupDraftStore(
    'cloud-backup-restore-draft-store',
)
