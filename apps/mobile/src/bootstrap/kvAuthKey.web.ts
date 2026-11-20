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

import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { setKvAuthKey } from '@perawallet/wallet-extension-platform-chrome'
import {
    getSessionKvAuthKey,
    onKvAuthKeyChanged,
} from '@perawallet/wallet-extension-vault-chrome'

// The records are sealed under a key that exists only while the vault is
// unlocked, so the store, hydrated before the key was known, is re-read once
// it arrives. setKvAuthKey keeps its own copy, so the caller's can be zeroed.
const applyKey = async (key: Nullable<Uint8Array>): Promise<void> => {
    setKvAuthKey(key)
    if (key === null) return
    key.fill(0)
    await useNetworkStore.persist.rehydrate()
}

export const applySessionKvAuthKey = async (): Promise<void> => {
    await applyKey(await getSessionKvAuthKey())
}

export const watchSessionKvAuthKey = (): (() => void) =>
    onKvAuthKeyChanged(key => void applyKey(key))
