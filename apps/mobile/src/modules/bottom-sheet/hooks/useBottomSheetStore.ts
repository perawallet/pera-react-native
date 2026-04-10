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

import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { create } from 'zustand'
import type { ComponentType } from 'react'
import type {
    BottomSheetOptions,
    BottomSheetStackEntry,
    InjectedSheetProps,
} from '../types'

type BottomSheetState = {
    stack: BottomSheetStackEntry[]
}

type BottomSheetActions = {
    pushSheet: <P extends InjectedSheetProps>(
        component: ComponentType<P>,
        props: Omit<P, keyof InjectedSheetProps>,
        options?: BottomSheetOptions,
    ) => string
    popSheet: () => void
    removeSheet: (id: string) => void
    clearSheets: () => void
    resetState: () => void
}

type BottomSheetStore = BottomSheetState & BottomSheetActions

const initialState: BottomSheetState = {
    stack: [],
}

export const useBottomSheetStore = create<BottomSheetStore>()(set => ({
    ...initialState,
    pushSheet: (component, props, options = {}) => {
        const id = generateOrderedUniqueId()
        const entry: BottomSheetStackEntry = {
            id,
            component: component as ComponentType<InjectedSheetProps>,
            props,
            options,
        }
        set(state => ({
            stack: [...state.stack, entry],
        }))
        return id
    },
    popSheet: () =>
        set(state => ({
            stack: state.stack.slice(0, -1),
        })),
    removeSheet: (id: string) =>
        set(state => ({
            stack: state.stack.filter(entry => entry.id !== id),
        })),
    clearSheets: () => set({ stack: [] }),
    resetState: () => set(initialState),
}))

type UseBottomSheetStackResult = {
    stack: BottomSheetStackEntry[]
    removeSheet: (id: string) => void
}

export const useBottomSheetStack = (): UseBottomSheetStackResult => {
    const stack = useBottomSheetStore(state => state.stack)
    const removeSheet = useBottomSheetStore(state => state.removeSheet)
    return { stack, removeSheet }
}
