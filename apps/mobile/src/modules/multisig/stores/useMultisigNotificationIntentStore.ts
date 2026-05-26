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

import { create } from 'zustand'

export type MultisigNotificationIntent = {
    kind: 'sign' | 'import'
    address: string
}

type State = {
    pendingIntent: MultisigNotificationIntent | null
}

type Actions = {
    setIntent: (intent: MultisigNotificationIntent) => void
    consumeIntent: () => void
    resetState: () => void
}

type Store = State & Actions

const initialState: State = {
    pendingIntent: null,
}

export const useMultisigNotificationIntentStore = create<Store>(set => ({
    ...initialState,
    setIntent: intent => set({ pendingIntent: intent }),
    consumeIntent: () => set({ pendingIntent: null }),
    resetState: () => set(initialState),
}))
