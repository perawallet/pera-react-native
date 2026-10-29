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
    readPasskeySetupPending,
    writePasskeySetupPending,
} from '@perawallet/wallet-extension-keystore-chrome'
import { logger } from '@perawallet/wallet-core-shared'

// Not persisted here: the truth lives in chrome.storage.session, which the
// keystore owns, so a popup closed by the OS passkey sheet reopens on the step.
type PasskeySetupStoreState = {
    /** null until hydrated from session storage. */
    isPending: boolean | null
}

type PasskeySetupStoreActions = {
    hydrate: () => Promise<void>
    /** Writes through to session storage before the in-memory flag moves. */
    setPending: (isPending: boolean) => Promise<void>
    /**
     * Never rejects: leaving the step must not depend on storage. A failed
     * write only means the step can come back on the next open.
     */
    clearPending: () => Promise<void>
    resetState: () => void
}

type PasskeySetupStore = PasskeySetupStoreState & PasskeySetupStoreActions

const initialState: PasskeySetupStoreState = { isPending: null }

// lanekeep-ignore-next-line pera/store-in-wipe-registry reason: mirror of the keystore's chrome.storage.session flag, hydrated once on shell mount; a reset to null leaves the unlocked shell resolving
export const usePasskeySetupStore = create<PasskeySetupStore>()(set => ({
    ...initialState,
    hydrate: async () => {
        // An unreadable flag must not hold the shell on resolving over an
        // optional step; the one-time offer prompt covers a missed step.
        const isPending = await readPasskeySetupPending().catch(
            (error: unknown) => {
                logger.warn('Passkey setup flag unreadable', { error })
                return false
            },
        )
        // A setPending that lands while the read is in flight must win, or
        // Create Password's write would be undone by the shell's own hydration.
        set(state => (state.isPending === null ? { isPending } : state))
    },
    setPending: async isPending => {
        await writePasskeySetupPending(isPending)
        set({ isPending })
    },
    clearPending: async () => {
        try {
            await writePasskeySetupPending(false)
        } catch (error) {
            logger.warn('Passkey setup flag not cleared', { error })
        }
        set({ isPending: false })
    },
    resetState: () => set(initialState),
}))
