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

/**
 * Transient, in-memory handoff for a recovery passphrase scanned from a QR /
 * recover-address deeplink. The scan resolves the account type (24 vs 25 words)
 * and then opens the Import screen pre-filled so the user confirms the words
 * before importing.
 *
 * The mnemonic is deliberately NOT passed as a navigation route param: route
 * params live in the navigation state tree, which can be captured by crash
 * reporters, navigation devtools, or future state persistence. This store is
 * plain (no `persist` middleware) so it never touches disk, and the value is
 * consumed-and-cleared the moment the Import screen reads it.
 */
type PendingImportMnemonicState = {
    pendingMnemonic: string | null
    resetState: () => void
}

const STORE_NAME = 'pending-import-mnemonic-store'

const initialState = {
    pendingMnemonic: null as string | null,
}

export const usePendingImportMnemonicStore: UseBoundStore<
    StoreApi<PendingImportMnemonicState>
> = create<PendingImportMnemonicState>(set => ({
    ...initialState,
    resetState: () => set(initialState),
}))

export const setPendingImportMnemonic = (mnemonic: string): void => {
    usePendingImportMnemonicStore.setState({ pendingMnemonic: mnemonic })
}

export const clearPendingImportMnemonic = (): void => {
    usePendingImportMnemonicStore.setState({ pendingMnemonic: null })
}

/**
 * Returns the pending mnemonic (if any) and clears it in the same call, so the
 * secret never lingers in the store after the Import screen has read it.
 */
export const consumePendingImportMnemonic = (): string | null => {
    const mnemonic = usePendingImportMnemonicStore.getState().pendingMnemonic
    usePendingImportMnemonicStore.setState({ pendingMnemonic: null })
    return mnemonic
}

registerStore({
    name: STORE_NAME,
    clearStorage: () => {},
    resetState: () => usePendingImportMnemonicStore.getState().resetState(),
})
