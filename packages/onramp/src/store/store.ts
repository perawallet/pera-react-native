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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import {
    guardedPersist,
    registerStore,
    type WithPersist,
    type Nullable,
    type BaseStoreState,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

import type { RampDepositInstructions } from '../models'

const STORE_NAME = 'onramp-store'

const MAX_REMEMBERED_DEPOSITS = 20

type OnrampState = BaseStoreState & {
    selectedSourceTokenId: Nullable<string>
    selectedDestinationTokenId: Nullable<string>
    senderAddress: string
    /**
     * Pay-in details of the deposit orders placed on this device, by order id.
     * The router's order items don't carry them, so History's pay-in card and
     * Cancel depend on this. Newest 20 kept.
     */
    depositInstructions: Record<string, RampDepositInstructions>
    setSelectedSourceTokenId: (id: Nullable<string>) => void
    setSelectedDestinationTokenId: (id: Nullable<string>) => void
    setSenderAddress: (address: string) => void
    rememberDepositInstructions: (
        orderId: string,
        instructions: RampDepositInstructions,
    ) => void
}

const initialState = {
    selectedSourceTokenId: null as Nullable<string>,
    selectedDestinationTokenId: null as Nullable<string>,
    senderAddress: '',
    depositInstructions: {} as Record<string, RampDepositInstructions>,
}

export const useOnrampStore: UseBoundStore<
    WithPersist<StoreApi<OnrampState>, unknown>
> = create<OnrampState>()(
    guardedPersist(
        set => ({
            ...initialState,
            setSelectedSourceTokenId: (id: Nullable<string>) =>
                set({ selectedSourceTokenId: id }),
            setSelectedDestinationTokenId: (id: Nullable<string>) =>
                set({ selectedDestinationTokenId: id }),
            setSenderAddress: (senderAddress: string) => set({ senderAddress }),
            rememberDepositInstructions: (orderId, instructions) =>
                set(state => {
                    const { [orderId]: _replaced, ...others } =
                        state.depositInstructions
                    const kept = Object.entries(others).slice(
                        -(MAX_REMEMBERED_DEPOSITS - 1),
                    )
                    return {
                        depositInstructions: {
                            ...Object.fromEntries(kept),
                            [orderId]: instructions,
                        },
                    }
                }),
            resetState: () => set({ ...initialState }),
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            // The destination and the deposit instructions stick across
            // sessions; the source is session-only so it's unset on every
            // fresh entry.
            partialize: state => ({
                selectedDestinationTokenId: state.selectedDestinationTokenId,
                depositInstructions: state.depositInstructions,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useOnrampStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useOnrampStore.getState().resetState(),
})
