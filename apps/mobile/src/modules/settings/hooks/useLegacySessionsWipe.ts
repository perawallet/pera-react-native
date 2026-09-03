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

import { useCallback } from 'react'

export type UseLegacySessionsWipeResult = {
    /** Disconnects every session still held outside the connection registry. */
    deleteAllSessions: () => Promise<void>
}

/**
 * A no-op on native, where the registry owns every session: the legacy store's
 * records were imported and its blob deleted, so there is nothing left to
 * disconnect. Reaching `useWalletConnectSessionsControl` here would rehydrate
 * that persisted store mid-wipe — its `partialize` keeps each connection's
 * `session.key` in plaintext — and anything genuinely left in it dies with the
 * `clearAllStores()` step, which the store is registered in.
 */
export const useLegacySessionsWipe = (): UseLegacySessionsWipeResult => {
    const deleteAllSessions = useCallback(() => Promise.resolve(), [])

    return { deleteAllSessions }
}
