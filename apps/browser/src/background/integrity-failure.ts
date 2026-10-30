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
    INTEGRITY_LAST_FAILURE_SESSION_KEY,
    type IntegrityLastFailure,
} from '@perawallet/wallet-core-browser-runtime'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

// The UI derives its access state from this; the worker never reads it to decide anything
// beyond a soft retry, so a lost write costs a less precise banner, never a loop.
export const recordLastFailure = async (
    failure: Omit<IntegrityLastFailure, 'at'>,
): Promise<void> => {
    await chrome.storage.session.set({
        [INTEGRITY_LAST_FAILURE_SESSION_KEY]: { ...failure, at: Date.now() },
    })
}

/** When the last failure the network was not to blame for happened; transport failures cost nothing. */
export const readLastAnsweredFailureAt = async (): Promise<
    Nullable<number>
> => {
    const stored = await chrome.storage.session.get(
        INTEGRITY_LAST_FAILURE_SESSION_KEY,
    )
    const failure = stored[INTEGRITY_LAST_FAILURE_SESSION_KEY] as Optional<{
        at?: unknown
        isTransport?: unknown
    }>
    if (failure?.isTransport === true) return null
    return typeof failure?.at === 'number' ? failure.at : null
}

/** Removes the record only when it belongs to `phase`: a mint success says nothing about enrolment. */
export const clearLastFailure = async (
    phase: IntegrityLastFailure['phase'],
): Promise<void> => {
    const stored = await chrome.storage.session.get(
        INTEGRITY_LAST_FAILURE_SESSION_KEY,
    )
    const current = stored[INTEGRITY_LAST_FAILURE_SESSION_KEY] as Optional<{
        phase?: unknown
    }>
    if (current?.phase === phase) {
        await chrome.storage.session.remove(INTEGRITY_LAST_FAILURE_SESSION_KEY)
    }
}
