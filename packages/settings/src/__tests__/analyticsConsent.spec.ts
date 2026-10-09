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

import { describe, test, expect, beforeEach, vi } from 'vitest'

const setCollectionEnabled = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        analytics: { setCollectionEnabled },
        keyValueStorage: {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
        },
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    registerStore: vi.fn(),
}))

import { useSettingsStore } from '../store'
import { syncAnalyticsConsent } from '../analyticsConsent'

describe('syncAnalyticsConsent', () => {
    let unsubscribe: () => void = () => undefined

    beforeEach(() => {
        unsubscribe()
        useSettingsStore.getState().resetState()
        setCollectionEnabled.mockClear()
    })

    test('keeps collection off until the user has answered', () => {
        unsubscribe = syncAnalyticsConsent()

        expect(setCollectionEnabled).toHaveBeenCalledExactlyOnceWith(false)
    })

    test('turns collection on when consent is granted and off when withdrawn', () => {
        unsubscribe = syncAnalyticsConsent()

        useSettingsStore.getState().setPreference('analyticsConsent', 'granted')
        useSettingsStore.getState().setPreference('analyticsConsent', 'denied')

        expect(setCollectionEnabled.mock.calls).toEqual([
            [false],
            [true],
            [false],
        ])
    })

    test('turns collection off when a reset clears the stored consent', () => {
        useSettingsStore.getState().setPreference('analyticsConsent', 'granted')
        unsubscribe = syncAnalyticsConsent()

        useSettingsStore.getState().resetState()

        expect(setCollectionEnabled.mock.calls).toEqual([[true], [false]])
    })

    test('ignores changes to other preferences', () => {
        unsubscribe = syncAnalyticsConsent()

        useSettingsStore.getState().setPreference('other', true)

        expect(setCollectionEnabled).toHaveBeenCalledTimes(1)
    })
})
