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

import { PASSKEY_SETUP_PENDING_KEY } from '../storage-keys'

// Session storage, like the master key: a browser restart forgets a step the
// user never reached, and the one-time prompt covers that user instead.
export const readPasskeySetupPending = async (): Promise<boolean> => {
    const stored = await chrome.storage.session.get(PASSKEY_SETUP_PENDING_KEY)
    return stored[PASSKEY_SETUP_PENDING_KEY] === true
}

export const writePasskeySetupPending = async (
    isPending: boolean,
): Promise<void> => {
    if (isPending) {
        await chrome.storage.session.set({ [PASSKEY_SETUP_PENDING_KEY]: true })
    } else {
        await chrome.storage.session.remove(PASSKEY_SETUP_PENDING_KEY)
    }
}
