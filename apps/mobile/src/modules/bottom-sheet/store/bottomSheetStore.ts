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

import { createElement } from 'react'
import {
    generateOrderedUniqueId,
    type Optional,
} from '@perawallet/wallet-core-shared'
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
    hostCount: number
}

type BottomSheetActions = {
    request: <T = unknown>(req: BottomSheetRequest) => Promise<Optional<T>>
    requestByType: <K extends keyof BottomSheetRegistry, T = unknown>(
        type: K,
        props: BottomSheetRegistry[K],
        options?: BottomSheetOptions,
    ) => Promise<Optional<T>>
    resolve: <T>(id: string, value: T) => void
    dismiss: (id?: string) => void
    dismissAll: () => void
    remove: (id: string) => void
    registerBottomSheetHost: () => void
    unregisterBottomSheetHost: () => void
    resetState: () => void
}

type BottomSheetStore = BottomSheetState & BottomSheetActions

const initialState: BottomSheetState = {
    requests: [],
    hostCount: 0,
}

// Captured value per id, populated by resolve, delivered on remove.
const pendingValues = new Map<string, unknown>()

export const useBottomSheetStore: UseBoundStore<StoreApi<BottomSheetStore>> =
    create<BottomSheetStore>()((set, get) => ({
        ...initialState,
        request: <T>(req: BottomSheetRequest) => {
            if (get().hostCount === 0) {
                // Fail loud: a request with no BottomSheetManager mounted
                // previously returned a promise that never settled — import
                // flows silently dead-ended.
                return Promise.reject(
                    new Error(
                        'Bottom sheet requested but no BottomSheetManager is ' +
                            'mounted. Mount <BottomSheetManager /> in the ' +
                            'shell before requesting sheets.',
                    ),
                ) as Promise<Optional<T>>
            }
            const id = req.id ?? generateOrderedUniqueId()
            let resolver!: (value: Optional<T>) => void
            const promise = new Promise<Optional<T>>(res => {
                resolver = res
            })
            const entry: InternalRequest = {
                id,
                contents: req.contents,
                options: req.options,
                isVisible: true,
                resolver: resolver as (value: unknown) => void,
            }
            // Dedupe by id. A driver can re-request a sheet whose previous
            // instance is still in the list mid-dismiss (isVisible: false,
            // not yet `remove`d). Appending a second entry with the same id
            // makes the manager render two children with the same React
            // key — React then omits one, so the sheet silently vanishes
            // (and logs a duplicate-key warning). Replace the stale entry
            // in place instead, resolving its promise so the prior caller
            // doesn't hang. The resolve + pendingValues cleanup happen here
            // (not inside the `set` updater) to keep the updater pure.
            const existing = get().requests.find(r => r.id === id)
            if (existing) {
                if (existing.isVisible) {
                    // Already open — ignore the duplicate request.
                    return Promise.resolve(undefined) as Promise<Optional<T>>
                }
                // Mid-dismiss dedupe (existing behaviour): replace the stale entry.
                pendingValues.delete(id)
                existing.resolver(undefined)
                set(state => ({
                    requests: state.requests.map(r =>
                        r.id === id ? entry : r,
                    ),
                }))
            } else {
                set(state => ({ requests: [...state.requests, entry] }))
            }
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
        registerBottomSheetHost: () => {
            set(state => ({ hostCount: state.hostCount + 1 }))
        },
        unregisterBottomSheetHost: () => {
            const hostCount = Math.max(0, get().hostCount - 1)
            if (hostCount > 0) {
                set({ hostCount })
                return
            }
            // Last host unmounted: settle every in-flight request the same
            // way a normal backdrop dismiss does (resolve with undefined,
            // same as dismiss()+remove()) instead of leaving callers hanging
            // forever on a request no host remains to render or dismiss.
            for (const req of get().requests) {
                req.resolver(undefined)
            }
            pendingValues.clear()
            set({ hostCount, requests: [] })
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
