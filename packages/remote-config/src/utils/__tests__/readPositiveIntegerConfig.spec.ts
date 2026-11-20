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
import { RemoteConfigKeys } from '@perawallet/wallet-extension-platform'

const { getNumberValueMock } = vi.hoisted(() => ({
    getNumberValueMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        remoteConfig: {
            getNumberValue: getNumberValueMock,
            getStringValue: (_key: string, fallback: string) => fallback,
            getBooleanValue: (_key: string, fallback: boolean) => fallback,
        },
    }),
}))

vi.mock('../areConfigOverridesIgnored', () => ({
    areConfigOverridesIgnored: () => false,
}))

import { useRemoteConfigStore } from '../../store'
import { readPositiveIntegerConfig } from '../readPositiveIntegerConfig'

const KEY = RemoteConfigKeys.evm_history_page_budget

describe('readPositiveIntegerConfig', () => {
    beforeEach(() => {
        getNumberValueMock.mockImplementation(
            (_key: string, fallback: number) => fallback,
        )
    })

    afterEach(() => {
        useRemoteConfigStore.setState({ configOverrides: {} })
    })

    it('reads the remote value', () => {
        getNumberValueMock.mockReturnValue(40)

        expect(readPositiveIntegerConfig(KEY, 55)).toBe(40)
    })

    it('lets a developer override win over the remote value', () => {
        getNumberValueMock.mockReturnValue(40)
        useRemoteConfigStore.setState({ configOverrides: { [KEY]: 12 } })

        expect(readPositiveIntegerConfig(KEY, 55)).toBe(12)
    })

    it.each([0, -3, 1.5, Number.NaN])('falls back for %s', value => {
        getNumberValueMock.mockReturnValue(value)

        expect(readPositiveIntegerConfig(KEY, 55)).toBe(55)
    })
})
