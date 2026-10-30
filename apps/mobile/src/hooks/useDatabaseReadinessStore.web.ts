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

export type DatabaseReadiness = 'pending' | 'ready' | 'failed'

// The approval surface renders before the shell's bootstrap opens the
// database, so anything there that reads it waits on this. 'failed' means
// bootstrap ended without a database; waiting would never resolve.
type DatabaseReadinessStoreState = {
    readiness: DatabaseReadiness
}

type DatabaseReadinessStoreActions = {
    setReadiness: (readiness: DatabaseReadiness) => void
    resetState: () => void
}

type DatabaseReadinessStore = DatabaseReadinessStoreState &
    DatabaseReadinessStoreActions

const initialState: DatabaseReadinessStoreState = {
    readiness: 'pending',
}

// lanekeep-ignore-next-line pera/store-in-wipe-registry reason: the wipe empties tables in place and the database stays open; a reset to pending leaves readers waiting forever
export const useDatabaseReadinessStore = create<DatabaseReadinessStore>()(
    set => ({
        ...initialState,
        setReadiness: readiness => set({ readiness }),
        resetState: () => set(initialState),
    }),
)
