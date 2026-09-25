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
    currentLanguage: 'en',
    acceptCurrentTerms: vi.fn(),
    onAccepted: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { termsOfServiceUrl: 'https://perawallet.app/terms-and-services/' },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
        currentLanguage: mocks.currentLanguage,
    }),
}))

vi.mock('../../../hooks/useTermsAcceptance', () => ({
    useTermsAcceptance: () => ({
        currentVersion: mocks.currentVersion,
        acceptCurrentTerms: mocks.acceptCurrentTerms,
    }),
}))

import { useTermsAcceptanceView } from '../useTermsAcceptanceView'
import embeddedTerms from '../embedded-terms.json'

const render = () =>
    renderHook(() => useTermsAcceptanceView(mocks.onAccepted))

const htmlOf = (source: { html: string } | { uri: string }) =>
    'html' in source ? source.html : undefined

describe('useTermsAcceptanceView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.currentVersion = embeddedTerms.version
        mocks.currentLanguage = 'en'
    })

    it('serves the bundled copy (no spinner, agree enabled) when the version matches', () => {
        const { result } = render()

        expect(htmlOf(result.current.source)).toContain('<html lang="en">')
        expect(result.current.showLoading).toBe(false)
        expect(result.current.isAgreeDisabled).toBe(false)
    })

    it.each(['de', 'es', 'fr', 'tr', 'pt-BR'])(
        'serves the %s bundled copy in that locale',
        locale => {
            mocks.currentLanguage = locale

            const { result } = render()

            expect(htmlOf(result.current.source)).toContain(
                `<html lang="${locale}">`,
            )
        },
    )

    it.each(['en-XA', '', 'xx'])(
        'falls back to the English copy for locale %j',
        locale => {
            mocks.currentLanguage = locale

            const { result } = render()

            expect(htmlOf(result.current.source)).toContain('<html lang="en">')
        },
    )

    it('loads the localized remote URL with agree disabled until it renders', () => {
        mocks.currentVersion = 'version-not-bundled'
        mocks.currentLanguage = 'fr'

        const { result } = render()

        expect(result.current.source).toEqual({
            uri: 'https://perawallet.app/terms-and-services/?lang=fr',
        })
        expect(result.current.showLoading).toBe(true)
        expect(result.current.isAgreeDisabled).toBe(true)

        act(() => result.current.onLoad())

        expect(result.current.isAgreeDisabled).toBe(false)
    })

    it('swaps to the bundled copy in the user locale when the remote load fails', () => {
        mocks.currentVersion = 'version-not-bundled'
        mocks.currentLanguage = 'de'

        const { result } = render()
        act(() => result.current.onError())
        // The bundled html then loads; that must not re-arm the remote path.
        act(() => result.current.onLoad())

        expect(htmlOf(result.current.source)).toContain('<html lang="de">')
        expect(result.current.showLoading).toBe(false)
        expect(result.current.isAgreeDisabled).toBe(false)

        act(() => result.current.onAgree())

        expect(mocks.acceptCurrentTerms).toHaveBeenCalledTimes(1)
    })

    it('records acceptance and invokes onAccepted on agree in a non-English locale', () => {
        mocks.currentLanguage = 'tr'
        const { result } = render()

        act(() => {
            result.current.onAgree()
        })

        expect(mocks.acceptCurrentTerms).toHaveBeenCalledTimes(1)
        expect(mocks.onAccepted).toHaveBeenCalledTimes(1)
    })
})
