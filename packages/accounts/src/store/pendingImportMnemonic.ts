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
import {
    mnemonicIndexToWord,
    mnemonicWordsToIndices,
    zeroBytes,
} from '@perawallet/wallet-core-kms'

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
 * The retained value is held as a scrubbable typed array, never a `string`: JS
 * strings are immutable and we have no control over the React Native heap/GC,
 * so a stored string can't be zeroed and may linger. Whenever every token is a
 * wordlist word (the normal case for a recovery phrase) we store a
 * `Uint16Array` of wordlist indices: it is zeroable AND, unlike UTF-8 bytes, it
 * holds opaque numbers rather than the dictionary words a memory scanner could
 * grep for. Input is not guaranteed valid (the deeplink only checks word
 * count), so a phrase containing a non-wordlist token falls back to UTF-8
 * `Uint8Array` bytes — still scrubbable, just not obfuscated.
 *
 * `clear`/`consume`/`reset` overwrite whichever buffer is held with zeros via
 * `zeroBytes`. (The transient strings at the boundaries — the scanned URL going
 * in, and the decoded value handed to the Import screen — are still unwipeable,
 * but the value the store retains between set and consume is.)
 */
type PendingImportMnemonicState = {
    /** Wordlist indices for a phrase whose every token is a wordlist word. */
    pendingIndices: Uint16Array | null
    /** UTF-8 fallback for a phrase containing a non-wordlist token. */
    pendingRawBytes: Uint8Array | null
    resetState: () => void
}

const STORE_NAME = 'pending-import-mnemonic-store'

const initialState = {
    pendingIndices: null as Uint16Array | null,
    pendingRawBytes: null as Uint8Array | null,
}

const wipe = (state: {
    pendingIndices: Uint16Array | null
    pendingRawBytes: Uint8Array | null
}): void => {
    zeroBytes(state.pendingIndices, state.pendingRawBytes)
}

export const usePendingImportMnemonicStore: UseBoundStore<
    StoreApi<PendingImportMnemonicState>
> = create<PendingImportMnemonicState>((set, get) => ({
    ...initialState,
    resetState: () => {
        wipe(get())
        set(initialState)
    },
}))

export const setPendingImportMnemonic = (mnemonic: string): void => {
    const words = mnemonic.trim().split(/\s+/).filter(Boolean)
    const indices = mnemonicWordsToIndices(words)
    // Zero any buffer already held (e.g. a previous scan) before it is
    // overwritten and left to GC — including the cross-type case where an
    // indexed phrase replaces raw bytes, or vice-versa.
    wipe(usePendingImportMnemonicStore.getState())
    usePendingImportMnemonicStore.setState(
        indices
            ? { pendingIndices: indices, pendingRawBytes: null }
            : {
                  pendingIndices: null,
                  pendingRawBytes: new TextEncoder().encode(words.join(' ')),
              },
    )
}

export const clearPendingImportMnemonic = (): void => {
    wipe(usePendingImportMnemonicStore.getState())
    usePendingImportMnemonicStore.setState({
        pendingIndices: null,
        pendingRawBytes: null,
    })
}

/**
 * Returns the pending mnemonic (if any) and clears it in the same call: the
 * decoded string is rebuilt from whichever buffer the store held, then that
 * buffer is zeroed and dropped, so the secret does not linger in the store
 * after the Import screen has read it.
 */
export const consumePendingImportMnemonic = (): string | null => {
    const { pendingIndices, pendingRawBytes } =
        usePendingImportMnemonicStore.getState()

    let mnemonic: string | null = null
    if (pendingIndices) {
        // Materialize the phrase string only here, at the consumption boundary
        // (the Import screen needs it), converting one index at a time rather
        // than holding a decoded word array in the store.
        mnemonic = Array.from(pendingIndices, mnemonicIndexToWord).join(' ')
    } else if (pendingRawBytes) {
        mnemonic = new TextDecoder().decode(pendingRawBytes)
    }

    zeroBytes(pendingIndices, pendingRawBytes)
    usePendingImportMnemonicStore.setState({
        pendingIndices: null,
        pendingRawBytes: null,
    })
    return mnemonic
}

registerStore({
    name: STORE_NAME,
    clearStorage: () => {},
    resetState: () => usePendingImportMnemonicStore.getState().resetState(),
})
