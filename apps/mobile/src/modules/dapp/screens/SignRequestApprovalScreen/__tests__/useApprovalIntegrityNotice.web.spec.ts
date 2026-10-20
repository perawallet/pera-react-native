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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    openExpandedTab,
    type IntegrityAccessState,
} from '@perawallet/wallet-core-browser-runtime'
import { useIntegrityFeedbackStore } from '@hooks/useIntegrityFeedbackStore'
import { useApprovalIntegrityNotice } from '../useApprovalIntegrityNotice.web'

const access = vi.hoisted(() => ({
    state: { status: 'pending' } as IntegrityAccessState,
}))

vi.mock('@hooks/useIntegrityAccessState.web', () => ({
    useIntegrityAccessState: () => ({
        state: access.state,
        retry: vi.fn(),
        verify: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-browser-runtime', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-browser-runtime')
    >()),
    openExpandedTab: vi.fn(async () => undefined),
}))

describe('useApprovalIntegrityNotice', () => {
    beforeEach(() => {
        access.state = {
            status: 'degraded',
            reason: 'service',
            cause: 'mint-5xx',
            nextAttemptAt: null,
        }
        useIntegrityFeedbackStore.getState().resetState()
        vi.mocked(openExpandedTab).mockClear()
    })

    it('stays hidden while nothing this request needed was refused', () => {
        const { result } = renderHook(() => useApprovalIntegrityNotice())

        expect(result.current.isVisible).toBe(false)
    })

    it('shows once a Pera call made for this request is refused', () => {
        const { result } = renderHook(() => useApprovalIntegrityNotice())

        act(() =>
            useIntegrityFeedbackStore.getState().emphasizeIntegrityStatus(),
        )

        expect(result.current.isVisible).toBe(true)
    })

    it('ignores refusals from before this window opened', () => {
        act(() =>
            useIntegrityFeedbackStore.getState().emphasizeIntegrityStatus(),
        )

        const { result } = renderHook(() => useApprovalIntegrityNotice())

        expect(result.current.isVisible).toBe(false)
    })

    it('goes once access is back', () => {
        const { result, rerender } = renderHook(() =>
            useApprovalIntegrityNotice(),
        )
        act(() =>
            useIntegrityFeedbackStore.getState().emphasizeIntegrityStatus(),
        )

        access.state = { status: 'ready', expiresAt: Date.now() + 60_000 }
        rerender()

        expect(result.current.isVisible).toBe(false)
    })

    it('opens Pera in a tab, where the check can run', () => {
        const { result } = renderHook(() => useApprovalIntegrityNotice())

        act(() => result.current.onOpenPera())

        expect(openExpandedTab).toHaveBeenCalledTimes(1)
    })
})
