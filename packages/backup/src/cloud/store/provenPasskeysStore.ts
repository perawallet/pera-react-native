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
import type { BackupPasskey } from '../sync/types'

type ProvenPasskeysState = BaseStoreState & {
    /** Credentials this device most recently proved it can re-derive.
     *  Written by `listPasskeys` on every sync tick — proving one runs a
     *  PBKDF2 per owning seed, so review screens and overview counts read
     *  this instead of re-deriving on a render path. A credential minted
     *  since the last sync is absent here until the next sync runs, the
     *  same lag natively-minted credentials already accept. */
    provenPasskeys: BackupPasskey[]
}

type ProvenPasskeysActions = {
    setProvenPasskeys: (passkeys: BackupPasskey[]) => void
}

export type ProvenPasskeysStore = ProvenPasskeysState & ProvenPasskeysActions

const initialState = { provenPasskeys: [] as BackupPasskey[] }

/**
 * Deliberately not persisted: a cold start re-runs `listPasskeys` before any
 * reader needs this, so there is no gap to bridge with disk state.
 */
export const useProvenPasskeysStore = create<ProvenPasskeysStore>()(set => ({
    ...initialState,
    setProvenPasskeys: provenPasskeys => set({ provenPasskeys }),
    resetState: () => set(initialState),
}))

registerStore({
    name: 'backup-proven-passkeys-store',
    clearStorage: () => useProvenPasskeysStore.getState().resetState(),
    resetState: () => useProvenPasskeysStore.getState().resetState(),
})
