/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { registerStore } from '@perawallet/wallet-core-shared'
import { zeroBytes } from '@perawallet/wallet-core-kms'

/**
 * Transient, in-memory handoff for a recovery passphrase scanned from a QR /
 * recover-address deeplink. The scan resolves the account type (24 vs 25 words)
 * and then opens the Import screen pre-filled so the user confirms the words
 * before importing.
 *
 * The mnemonic is deliberately NOT passed as a navigation route param: route
 * params live in the navigation state tree, which can be captured by crash
 * reporters, navigation devtools, or future state persistence. This store is
 * plain (no `persist` middleware) so it never touches disk.
 *
 * It is held as UTF-8 `Uint8Array` bytes rather than a `string` so the retained
 * secret can actually be wiped: JS strings are immutable and we have no control
 * over the React Native heap/GC, so a stored string can't be zeroed and may
 * linger. This mirrors how other in-memory secrets are handled in the repo —
 * PIN (`packages/security/src/pinRecord.ts`), card tokens, and seed/key
 * material all encode to bytes and scrub with `zeroBytes`. `clear`/`consume`/
 * `reset` overwrite the buffer with zeros via `zeroBytes`. (The transient
 * strings at the boundaries — the scanned URL going in, and the decoded value
 * handed to the Import screen — are still unwipeable, but the value the store
 * retains between set and consume is.)
 */
type PendingImportMnemonicState = {
    pendingMnemonicBytes: Uint8Array | null
    resetState: () => void
}

const STORE_NAME = 'pending-import-mnemonic-store'

const initialState = {
    pendingMnemonicBytes: null as Uint8Array | null,
}

export const usePendingImportMnemonicStore: UseBoundStore<
    StoreApi<PendingImportMnemonicState>
> = create<PendingImportMnemonicState>((set, get) => ({
    ...initialState,
    resetState: () => {
        zeroBytes(get().pendingMnemonicBytes)
        set(initialState)
    },
}))

export const setPendingImportMnemonic = (mnemonic: string): void => {
    usePendingImportMnemonicStore.setState({
        pendingMnemonicBytes: new TextEncoder().encode(mnemonic.trim()),
    })
}

export const clearPendingImportMnemonic = (): void => {
    zeroBytes(usePendingImportMnemonicStore.getState().pendingMnemonicBytes)
    usePendingImportMnemonicStore.setState({ pendingMnemonicBytes: null })
}

/**
 * Returns the pending mnemonic (if any) and clears it in the same call: the
 * decoded string is handed back, then the buffer the store held is zeroed and
 * dropped, so the secret does not linger in the store after the Import screen
 * has read it.
 */
export const consumePendingImportMnemonic = (): string | null => {
    const bytes = usePendingImportMnemonicStore.getState().pendingMnemonicBytes
    if (!bytes) return null
    const mnemonic = new TextDecoder().decode(bytes)
    zeroBytes(bytes)
    usePendingImportMnemonicStore.setState({ pendingMnemonicBytes: null })
    return mnemonic
}

registerStore({
    name: STORE_NAME,
    clearStorage: () => {},
    resetState: () => usePendingImportMnemonicStore.getState().resetState(),
})
