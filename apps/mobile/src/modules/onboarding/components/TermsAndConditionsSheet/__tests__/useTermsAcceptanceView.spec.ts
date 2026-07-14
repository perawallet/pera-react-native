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

import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    currentVersion: '1',
    acceptCurrentTerms: vi.fn(),
    onAccepted: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { termsOfServiceUrl: 'https://perawallet.app/terms-and-services/' },
}))

vi.mock('../../../hooks/useTermsAcceptance', () => ({
    useTermsAcceptance: () => ({
        currentVersion: mocks.currentVersion,
        acceptCurrentTerms: mocks.acceptCurrentTerms,
    }),
}))

import { useTermsAcceptanceView } from '../useTermsAcceptanceView'
import embeddedTerms from '../embedded-terms.json'

describe('useTermsAcceptanceView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.currentVersion = embeddedTerms.version
    })

    it('serves the bundled copy (no spinner) when the version matches', () => {
        const { result } = renderHook(() =>
            useTermsAcceptanceView(mocks.onAccepted),
        )

        expect('html' in result.current.source).toBe(true)
        expect(result.current.showLoading).toBe(false)
    })

    it('falls back to the remote URL (with spinner) when the version differs', () => {
        mocks.currentVersion = 'version-not-bundled'

        const { result } = renderHook(() =>
            useTermsAcceptanceView(mocks.onAccepted),
        )

        expect('uri' in result.current.source).toBe(true)
        expect(result.current.showLoading).toBe(true)
    })

    it('records acceptance and invokes onAccepted on agree', () => {
        const { result } = renderHook(() =>
            useTermsAcceptanceView(mocks.onAccepted),
        )

        act(() => {
            result.current.onAgree()
        })

        expect(mocks.acceptCurrentTerms).toHaveBeenCalledTimes(1)
        expect(mocks.onAccepted).toHaveBeenCalledTimes(1)
    })
})
