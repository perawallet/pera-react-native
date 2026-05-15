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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockShowToast = vi.fn()
const mockShowError = vi.fn()

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useHandleRekeyError } from '../useHandleRekeyError'
import { RekeyError } from '../RekeyError'

describe('useHandleRekeyError', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows the cancellation toast for a user_rejected error and does not show an error toast', () => {
        const { result } = renderHook(() => useHandleRekeyError())

        result.current(new RekeyError('user_rejected'))

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
        expect(mockShowError).not.toHaveBeenCalled()
    })

    it('routes the original cause through showError with a stage-specific fallback title', () => {
        const cause = new Error('algod unreachable')
        const { result } = renderHook(() => useHandleRekeyError())

        result.current(new RekeyError('submission_failed', cause))

        expect(mockShowError).toHaveBeenCalledWith(
            cause,
            'rekey.errors.submission_failed.title',
        )
        expect(mockShowToast).not.toHaveBeenCalled()
    })

    it('falls back to the RekeyError itself when no original cause is attached', () => {
        const rekeyError = new RekeyError('build_failed')
        const { result } = renderHook(() => useHandleRekeyError())

        result.current(rekeyError)

        expect(mockShowError).toHaveBeenCalledWith(
            rekeyError,
            'rekey.errors.build_failed.title',
        )
    })

    it('shows a generic error toast for non-RekeyError values', () => {
        const error = new Error('boom')
        const { result } = renderHook(() => useHandleRekeyError())

        result.current(error)

        expect(mockShowError).toHaveBeenCalledWith(error)
        expect(mockShowToast).not.toHaveBeenCalled()
    })
})
