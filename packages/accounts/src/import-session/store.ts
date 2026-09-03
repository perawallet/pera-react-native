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
import type { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import { registerStore } from '@perawallet/wallet-core-shared'

/**
 * Holds the in-flight HD import session: the data we computed in memory
 * after the user typed a mnemonic but before they confirmed which addresses
 * to actually persist. Intentionally NOT persisted — losing it on app restart
 * is the desired security behavior; the user just retypes the mnemonic.
 */

export type HDImportSession = {
    walletKeyId: string
    rootKey: Uint8Array
    entropy: Uint8Array
    derivationType: BIP32DerivationType
}

type State = {
    pending: HDImportSession | null
}

type Actions = {
    start: (session: HDImportSession) => void
    resetState: () => void
}

const STORE_NAME = 'hd-import-session-store'

export const useHDImportSessionStore = create<State & Actions>((set, get) => ({
    pending: null,
    start: session => {
        const prev = get().pending
        if (prev) zeroBytes(prev.rootKey, prev.entropy)
        set({ pending: session })
    },
    resetState: () => {
        const prev = get().pending
        if (prev) zeroBytes(prev.rootKey, prev.entropy)
        set({ pending: null })
    },
}))

registerStore({
    name: STORE_NAME,
    // In-memory only store; nothing persisted to clear.
    clearStorage: () => {},
    resetState: () => useHDImportSessionStore.getState().resetState(),
})
