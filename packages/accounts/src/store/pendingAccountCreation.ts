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

type PendingRollback = () => Promise<void>

type PendingAccountCreationState = {
    pendingRollback: PendingRollback | null
    resetState: () => void
}

const STORE_NAME = 'pending-account-creation-store'

const initialState = {
    pendingRollback: null as PendingRollback | null,
}

export const usePendingAccountCreationStore: UseBoundStore<
    StoreApi<PendingAccountCreationState>
> = create<PendingAccountCreationState>(set => ({
    ...initialState,
    resetState: () => set(initialState),
}))

export const setPendingAccountRollback = (rollback: PendingRollback): void => {
    const existing = usePendingAccountCreationStore.getState().pendingRollback
    if (existing && existing !== rollback) {
        existing().catch(() => {})
    }
    usePendingAccountCreationStore.setState({ pendingRollback: rollback })
}

export const clearPendingAccountRollback = (): void => {
    usePendingAccountCreationStore.setState({ pendingRollback: null })
}

export const consumePendingAccountRollback = async (): Promise<void> => {
    const cb = usePendingAccountCreationStore.getState().pendingRollback
    usePendingAccountCreationStore.setState({ pendingRollback: null })
    if (cb) await cb()
}

registerStore({
    name: STORE_NAME,
    clearStorage: () => {},
    resetState: () => usePendingAccountCreationStore.getState().resetState(),
})
