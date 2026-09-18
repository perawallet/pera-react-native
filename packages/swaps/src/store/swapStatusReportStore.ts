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
import { persist, createJSONStorage } from 'zustand/middleware'
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { SwapStatusUpdateRequest } from '../api/swaps/schema'

const STORE_NAME = 'swap-status-report-store'

export type PendingSwapStatusReport = {
    swapId: string
    data: SwapStatusUpdateRequest
    queuedAt: number
}

export type SwapStatusReportState = {
    reports: PendingSwapStatusReport[]
    enqueueReport: (report: {
        swapId: string
        data: SwapStatusUpdateRequest
    }) => void
    removeReport: (swapId: string, status: string) => void
    resetState: () => void
}

const initialState = {
    reports: [] as PendingSwapStatusReport[],
}

/**
 * Persisted queue of backend swap-status reports awaiting delivery.
 *
 * A status PATCH must never be lost to a dropped connection nor block the
 * UI. Reports are queued here and flushed by `useSwapStatusReportFlush` on
 * mount and on every online transition; persistence means a report queued
 * just before the app closes still goes out on next launch.
 */
export const useSwapStatusReportStore: UseBoundStore<
    WithPersist<StoreApi<SwapStatusReportState>, unknown>
> = create<SwapStatusReportState>()(
    persist(
        set => ({
            ...initialState,
            enqueueReport: ({ swapId, data }) =>
                set(state => ({
                    reports: [
                        // One report per swap and status: a later enqueue supersedes
                        // an unsent earlier one rather than double-reporting.
                        ...state.reports.filter(
                            report =>
                                report.swapId !== swapId ||
                                report.data.status !== data.status,
                        ),
                        { swapId, data, queuedAt: Date.now() },
                    ],
                })),
            removeReport: (swapId, status) =>
                set(state => ({
                    reports: state.reports.filter(
                        report =>
                            report.swapId !== swapId ||
                            report.data.status !== status,
                    ),
                })),
            resetState: () => set({ ...initialState }),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({ reports: state.reports }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useSwapStatusReportStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useSwapStatusReportStore.getState().resetState(),
})
