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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'

const { getNumberValueMock } = vi.hoisted(() => ({
    getNumberValueMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({ state: { keys: [] } }),
    getProvider: () => ({
        remoteConfig: {
            getNumberValue: getNumberValueMock,
            getStringValue: (_key: string, fallback: string) => fallback,
            getBooleanValue: (_key: string, fallback: boolean) => fallback,
        },
        deviceInfo: {
            getDevicePlatform: () => 'ios',
            isStoreBuild: () => false,
        },
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

import { getAlgorandAddressPoisoningRules } from '../address-poisoning'

describe('getAlgorandAddressPoisoningRules', () => {
    beforeEach(() => {
        useRemoteConfigStore.setState({ configOverrides: {} })
        getNumberValueMock.mockImplementation(
            (_key: string, fallback: number) => fallback,
        )
    })

    it('treats incoming payments up to 0.001 ALGO as dust by default', () => {
        expect(
            getAlgorandAddressPoisoningRules().dustCeiling.equals(1000),
        ).toBe(true)
    })

    it('reads the current remote value on every call', () => {
        getNumberValueMock.mockImplementation(
            (key: string, fallback: number) =>
                key === 'address_poisoning_lookalike_chars' ? 6 : fallback,
        )

        expect(getAlgorandAddressPoisoningRules().lookalikeMatchedChars).toBe(6)
    })

    it('lets a developer override win over the remote value', () => {
        useRemoteConfigStore.setState({
            configOverrides: { address_poisoning_dust_ceiling: 5000 },
        })

        expect(
            getAlgorandAddressPoisoningRules().dustCeiling.equals(5000),
        ).toBe(true)
    })
})
