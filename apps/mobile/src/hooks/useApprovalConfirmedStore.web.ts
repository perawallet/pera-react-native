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
import { APPROVAL_SUCCESS_CLOSE_DELAY_MS } from '@constants/ui'

// Set once an approval window's decision has reached the dApp, so the primary
// control can show its success state for the beat before the window closes.
type ApprovalConfirmedStoreState = {
    isConfirmed: boolean
}

type ApprovalConfirmedStoreActions = {
    setConfirmed: () => void
    resetState: () => void
}

type ApprovalConfirmedStore = ApprovalConfirmedStoreState &
    ApprovalConfirmedStoreActions

const initialState: ApprovalConfirmedStoreState = {
    isConfirmed: false,
}

export const useApprovalConfirmedStore = create<ApprovalConfirmedStore>()(
    set => ({
        ...initialState,
        setConfirmed: () => set({ isConfirmed: true }),
        resetState: () => set(initialState),
    }),
)

/**
 * Call only after the dApp's answer is delivered. The bridge leaves a
 * successfully settled window open, so this close is the only one it gets.
 */
export const showConfirmedThenClose = async (): Promise<void> => {
    useApprovalConfirmedStore.getState().setConfirmed()
    await new Promise<void>(resolve =>
        setTimeout(resolve, APPROVAL_SUCCESS_CLOSE_DELAY_MS),
    )
    window.close()
}
