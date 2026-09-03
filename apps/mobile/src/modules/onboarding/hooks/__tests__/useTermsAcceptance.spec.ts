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
    // `undefined` models remote config before fetchAndActivate: getStringValue
    // returns the caller's fallback. `''` does not — it is a real value and
    // never reaches the fallback branch.
    termsVersion: '1' as string | undefined,
    preferences: {} as Record<string, string | boolean | number>,
    setPreference: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    RemoteConfigKeys: { terms_version: 'terms_version' },
    useRemoteConfig: () => ({
        getStringValue: (_key: string, fallback: string) =>
            mocks.termsVersion ?? fallback,
    }),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettingsStore: (
        selector: (state: {
            preferences: Record<string, string | boolean | number>
            setPreference: (key: string, value: string) => void
        }) => unknown,
    ) =>
        selector({
            preferences: mocks.preferences,
            setPreference: mocks.setPreference,
        }),
}))

import {
    useTermsAcceptance,
    ACCEPTED_TERMS_VERSION_KEY,
} from '../useTermsAcceptance'

describe('useTermsAcceptance', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.termsVersion = '1'
        mocks.preferences = {}
    })

    it('needs acceptance on first launch (nothing stored)', () => {
        const { result } = renderHook(() => useTermsAcceptance())

        expect(result.current.currentVersion).toBe('1')
        expect(result.current.needsAcceptance).toBe(true)
    })

    it('does not need acceptance when the stored version matches', () => {
        mocks.preferences = { [ACCEPTED_TERMS_VERSION_KEY]: '1' }

        const { result } = renderHook(() => useTermsAcceptance())

        expect(result.current.needsAcceptance).toBe(false)
    })

    it('needs acceptance again when the remote version is bumped', () => {
        mocks.preferences = { [ACCEPTED_TERMS_VERSION_KEY]: '1' }
        mocks.termsVersion = '2'

        const { result } = renderHook(() => useTermsAcceptance())

        expect(result.current.needsAcceptance).toBe(true)
    })

    it('does not gate when no terms version is available', () => {
        mocks.termsVersion = ''

        const { result } = renderHook(() => useTermsAcceptance())

        expect(result.current.needsAcceptance).toBe(false)
    })

    it('does not gate while the remote version is unresolved', () => {
        mocks.termsVersion = undefined

        const { result } = renderHook(() => useTermsAcceptance())

        expect(result.current.needsAcceptance).toBe(false)
    })

    it('gates once against the real version once config resolves', () => {
        //'s duplicate T&Cs: a placeholder fallback read as a genuine
        // version, so the user accepted it, the real version then activated and
        // the gate fired a second time.
        mocks.termsVersion = undefined
        const { result, rerender } = renderHook(() => useTermsAcceptance())
        expect(result.current.needsAcceptance).toBe(false)

        mocks.termsVersion = '2'
        rerender()

        expect(result.current.currentVersion).toBe('2')
        expect(result.current.needsAcceptance).toBe(true)
    })

    it('persists the current version on accept', () => {
        mocks.termsVersion = '2'

        const { result } = renderHook(() => useTermsAcceptance())
        act(() => {
            result.current.acceptCurrentTerms()
        })

        expect(mocks.setPreference).toHaveBeenCalledWith(
            ACCEPTED_TERMS_VERSION_KEY,
            '2',
        )
    })
})
