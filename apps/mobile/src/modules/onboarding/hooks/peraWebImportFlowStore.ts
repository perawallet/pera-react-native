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
import type {
    PeraWebBackupPayload,
    PeraWebQrPayload,
} from '@perawallet/wallet-core-backup'
import { zeroBytes } from '@perawallet/wallet-core-kms'

// Transient state for the Pera Web import wizard. Holds the QR-decoded
// payload (from the scanner) and the decrypted backup (from the loading
// step). Kept in memory only — decrypted private keys must never persist
// across app launches. Mirrors `asbImportFlowStore` in shape.

type State = {
    qr: PeraWebQrPayload | null
    payload: PeraWebBackupPayload | null
}

type Actions = {
    setQr: (qr: PeraWebQrPayload) => void
    setPayload: (payload: PeraWebBackupPayload) => void
    reset: () => void
}

const initialState: State = {
    qr: null,
    payload: null,
}

export const usePeraWebImportFlowStore = create<State & Actions>(
    (set, get) => ({
        ...initialState,
        setQr: qr => set({ qr }),
        setPayload: payload => set({ payload }),
        reset: () => {
            // Wipe decrypted seeds before dropping the reference. The QR's
            // encryptionKey is wiped on the same pass since it's also
            // secret material.
            const state = get()
            if (state.payload) {
                for (const account of state.payload.accounts) {
                    zeroBytes(account.privateKey)
                }
            }
            if (state.qr) {
                zeroBytes(state.qr.encryptionKey)
            }
            set(initialState)
        },
    }),
)
