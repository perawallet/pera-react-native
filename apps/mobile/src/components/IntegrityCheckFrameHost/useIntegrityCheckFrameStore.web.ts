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

type IntegrityCheckFrameState = {
    url: string | null
    /** Epoch milliseconds. */
    deadlineAt: number | null
    isExpanded: boolean
    // The frame is gone but the host port stays held until the worker ends
    // the attempt, so the solve cannot lose a race with the port closing.
    isFinished: boolean
    show: (url: string, deadlineAt: number) => void
    setExpanded: (isExpanded: boolean) => void
    finish: () => void
    hide: () => void
}

export const useIntegrityCheckFrameStore = create<IntegrityCheckFrameState>(
    set => ({
        url: null,
        deadlineAt: null,
        isExpanded: false,
        isFinished: false,
        show: (url, deadlineAt) =>
            set({ url, deadlineAt, isExpanded: false, isFinished: false }),
        setExpanded: isExpanded => set({ isExpanded }),
        finish: () => set({ isExpanded: false, isFinished: true }),
        hide: () =>
            set({
                url: null,
                deadlineAt: null,
                isExpanded: false,
                isFinished: false,
            }),
    }),
)
