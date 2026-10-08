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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FundingType } from '@perawallet/wallet-core-card'
import { EXTENDED_TOAST_DURATION_MS } from '@constants/ui'

const {
    mockSetSelectedFundingType,
    mockInvalidateCardQueries,
    mockSuccessToast,
    mockShowToast,
    mockNavigate,
    scheduled,
} = vi.hoisted(() => ({
    mockSetSelectedFundingType: vi.fn(),
    mockInvalidateCardQueries: vi.fn(),
    mockSuccessToast: vi.fn(),
    mockShowToast: vi.fn(),
    mockNavigate: vi.fn(),
    scheduled: { callback: null as (() => void) | null },
}))

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStore: Object.assign(vi.fn(), {
            getState: () => ({
                setSelectedFundingType: mockSetSelectedFundingType,
            }),
        }),
        invalidateCardQueries: mockInvalidateCardQueries,
    }
})

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({}),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mockSuccessToast,
        errorToast: vi.fn(),
        infoToast: vi.fn(),
        showToast: mockShowToast,
    }),
}))

vi.mock('@hooks/useLanguage')

// Captures the scheduled callback so tests can assert what happens before and
// after the delay without fake timers.
vi.mock('@hooks/useRunAfterDelay', () => ({
    useRunAfterDelay: () => ({
        schedule: (callback: () => void) => {
            scheduled.callback = callback
        },
        flush: vi.fn(),
        cancel: vi.fn(),
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

import { useFinishCardCreation } from '../useFinishCardCreation'

const runScheduled = () => {
    expect(scheduled.callback).not.toBeNull()
    scheduled.callback?.()
}

describe('useFinishCardCreation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        scheduled.callback = null
    })

    it('persists the funding type and invalidates queries immediately, then redirects and shows the success toast after the delay', () => {
        const { result } = renderHook(() => useFinishCardCreation())

        result.current.finish(FundingType.Manual, false)

        expect(mockSetSelectedFundingType).toHaveBeenCalledWith(
            FundingType.Manual,
        )
        expect(mockInvalidateCardQueries).toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(mockSuccessToast).not.toHaveBeenCalled()

        runScheduled()

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: { screen: 'PeraCardAccount' },
        })
        expect(mockSuccessToast).toHaveBeenCalledTimes(1)
        expect(mockShowToast).not.toHaveBeenCalled()
    })

    it('shows the degraded toast on the dashboard with an extended duration when auto-funding degraded', () => {
        const { result } = renderHook(() => useFinishCardCreation())

        result.current.finish(FundingType.Manual, true)
        expect(mockShowToast).not.toHaveBeenCalled()

        runScheduled()

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: { screen: 'PeraCardAccount' },
        })
        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: 'peraCard.setup_status.auto_funding_degraded_title',
                body: 'peraCard.setup_status.auto_funding_degraded_body',
                type: 'info',
            },
            { duration: EXTENDED_TOAST_DURATION_MS },
        )
        expect(mockSuccessToast).not.toHaveBeenCalled()
    })

    it('shows the toast only after navigating so it lands on the dashboard', () => {
        const order: string[] = []
        mockNavigate.mockImplementation(() => order.push('navigate'))
        mockShowToast.mockImplementation(() => order.push('toast'))
        const { result } = renderHook(() => useFinishCardCreation())

        result.current.finish(FundingType.Manual, true)
        runScheduled()

        expect(order).toEqual(['navigate', 'toast'])
    })
})
