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

const {
    mockSetSelectedFundingType,
    mockInvalidateCardQueries,
    mockSuccessToast,
    mockInfoToast,
    mockNavigate,
} = vi.hoisted(() => ({
    mockSetSelectedFundingType: vi.fn(),
    mockInvalidateCardQueries: vi.fn(),
    mockSuccessToast: vi.fn(),
    mockInfoToast: vi.fn(),
    mockNavigate: vi.fn(),
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
        infoToast: mockInfoToast,
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

// Runs the scheduled callback synchronously so tests don't need fake timers —
// the delay itself isn't this hook's behavior under test.
vi.mock('@hooks/useRunAfterDelay', () => ({
    useRunAfterDelay: () => ({
        schedule: (callback: () => void) => callback(),
        flush: vi.fn(),
        cancel: vi.fn(),
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

import { useFinishCardCreation } from '../useFinishCardCreation'

describe('useFinishCardCreation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('persists the funding type, invalidates queries, and redirects on success', () => {
        const { result } = renderHook(() => useFinishCardCreation())

        result.current.finish(FundingType.Manual, false)

        expect(mockSetSelectedFundingType).toHaveBeenCalledWith(
            FundingType.Manual,
        )
        expect(mockInvalidateCardQueries).toHaveBeenCalled()
        expect(mockSuccessToast).toHaveBeenCalled()
        expect(mockInfoToast).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
            screen: 'PeraCardAccount',
        })
    })

    it('shows the degraded toast instead of the success toast when auto-funding degraded', () => {
        const { result } = renderHook(() => useFinishCardCreation())

        result.current.finish(FundingType.Manual, true)

        expect(mockInfoToast).toHaveBeenCalled()
        expect(mockSuccessToast).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
            screen: 'PeraCardAccount',
        })
    })
})
