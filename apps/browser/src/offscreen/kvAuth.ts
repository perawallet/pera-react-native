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

import {
    requestKvAuthKey,
    type OffscreenLockState,
} from '@perawallet/wallet-core-browser-runtime'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { setKvAuthKey } from '@perawallet/wallet-extension-platform-chrome'

/**
 * Keeps the offscreen document's record-authentication key in step with the
 * vault: fetched on unlock, dropped on lock. The key unlocks the records the
 * wallet itself wrote, so the stores are re-read once it arrives. Returns the
 * unsubscribe function.
 */
export const startOffscreenKvAuth = async (
    lockState: OffscreenLockState,
): Promise<() => void> => {
    // Lets a slow reply for an earlier unlock lose to a later lock.
    let generation = 0

    const apply = async (isLocked: Optional<boolean>): Promise<void> => {
        const current = ++generation
        // An unknown state counts as locked, like the mirror itself does.
        if (isLocked !== false) {
            setKvAuthKey(null)
            return
        }
        const key = await requestKvAuthKey()
        if (current !== generation) {
            key?.fill(0)
            return
        }
        setKvAuthKey(key)
        key?.fill(0)
        if (key !== null) await useNetworkStore.persist.rehydrate()
    }

    const unsubscribe = lockState.subscribe(isLocked => void apply(isLocked))
    await apply(await lockState.ready)
    return unsubscribe
}
