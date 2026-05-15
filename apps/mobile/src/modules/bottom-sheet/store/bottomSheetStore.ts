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

import { createElement } from 'react'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { create, type StoreApi, type UseBoundStore } from 'zustand'

import type {
    BottomSheetOptions,
    BottomSheetRegistry,
    BottomSheetRequest,
    InternalRequest,
} from '../types'
import { getRegisteredBottomSheet } from '../registry/registry'

type BottomSheetState = {
    requests: InternalRequest[]
}

type BottomSheetActions = {
    request: <T = unknown>(req: BottomSheetRequest) => Promise<T | undefined>
    requestByType: <K extends keyof BottomSheetRegistry, T = unknown>(
        type: K,
        props: BottomSheetRegistry[K],
        options?: BottomSheetOptions,
    ) => Promise<T | undefined>
    resolve: <T>(id: string, value: T) => void
    dismiss: (id?: string) => void
    dismissAll: () => void
    remove: (id: string) => void
    resetState: () => void
}

type BottomSheetStore = BottomSheetState & BottomSheetActions

const initialState: BottomSheetState = {
    requests: [],
}

// Captured value per id, populated by resolve, delivered on remove.
const pendingValues = new Map<string, unknown>()

export const useBottomSheetStore: UseBoundStore<StoreApi<BottomSheetStore>> =
    create<BottomSheetStore>()(set => ({
        ...initialState,
        request: <T>(req: BottomSheetRequest) => {
            const id = req.id ?? generateOrderedUniqueId()
            let resolver!: (value: T | undefined) => void
            const promise = new Promise<T | undefined>(res => {
                resolver = res
            })
            set(state => ({
                requests: [
                    ...state.requests,
                    {
                        id,
                        contents: req.contents,
                        options: req.options,
                        isVisible: true,
                        resolver: resolver as (value: unknown) => void,
                    },
                ],
            }))
            return promise
        },
        requestByType: (type, props, options) => {
            const component = getRegisteredBottomSheet(type as string)
            if (!component) {
                throw new Error(
                    `Bottom sheet type "${String(type)}" is not registered. ` +
                        'Add a registerBottomSheet(...) call in ' +
                        'apps/mobile/src/modules/bottom-sheet/registrations.ts',
                )
            }
            return useBottomSheetStore.getState().request({
                contents: createElement(component, props),
                options,
            })
        },
        resolve: <T>(id: string, value: T) => {
            set(state => {
                if (!state.requests.some(r => r.id === id)) return {}
                pendingValues.set(id, value)
                return {
                    requests: state.requests.map(r =>
                        r.id === id ? { ...r, isVisible: false } : r,
                    ),
                }
            })
        },
        dismiss: (id?: string) => {
            set(state => {
                const target =
                    id ?? state.requests[state.requests.length - 1]?.id
                if (!target) return {}
                if (!state.requests.some(r => r.id === target)) return {}
                // dismiss intentionally does NOT populate pendingValues
                return {
                    requests: state.requests.map(r =>
                        r.id === target ? { ...r, isVisible: false } : r,
                    ),
                }
            })
        },
        dismissAll: () => {
            set(state => ({
                requests: state.requests.map(r => ({
                    ...r,
                    isVisible: false,
                })),
            }))
        },
        remove: (id: string) => {
            set(state => {
                const target = state.requests.find(r => r.id === id)
                if (!target) return {}
                const value = pendingValues.get(id)
                pendingValues.delete(id)
                target.resolver(value)
                return {
                    requests: state.requests.filter(r => r.id !== id),
                }
            })
        },
        resetState: () => {
            // Resolve any pending promises with undefined so callers don't hang.
            set(state => {
                for (const req of state.requests) {
                    req.resolver(undefined)
                }
                return initialState
            })
            pendingValues.clear()
        },
    }))
