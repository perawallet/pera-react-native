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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APPROVAL_SUCCESS_CLOSE_DELAY_MS } from '@constants/ui'
import {
    showConfirmedThenClose,
    useApprovalConfirmedStore,
} from '@hooks/useApprovalConfirmedStore.web'

describe('showConfirmedThenClose', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.spyOn(window, 'close').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        useApprovalConfirmedStore.getState().resetState()
    })

    it('shows the confirmed state at once and closes the window only after the delay', async () => {
        const done = showConfirmedThenClose()

        expect(useApprovalConfirmedStore.getState().isConfirmed).toBe(true)
        await vi.advanceTimersByTimeAsync(APPROVAL_SUCCESS_CLOSE_DELAY_MS - 1)
        expect(window.close).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(1)
        await done
        expect(window.close).toHaveBeenCalledTimes(1)
    })
})
