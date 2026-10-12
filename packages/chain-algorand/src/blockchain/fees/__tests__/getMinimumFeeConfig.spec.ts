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

import { getMinimumFeeConfig } from '../getMinimumFeeConfig'

describe('getMinimumFeeConfig', () => {
    beforeEach(() => {
        useRemoteConfigStore.setState({ configOverrides: {} })
        getNumberValueMock.mockImplementation(
            (key: string, fallback: number) =>
                key === 'fee_min_txn_fee' ? 2000 : fallback,
        )
    })

    it('reads the fee config from remote config, outside React', () => {
        expect(getMinimumFeeConfig()).toEqual({
            minTxnFee: 2000n,
            pqMultiplier: 3n,
            assetMbr: 100000n,
            baseAccountMbr: 100000n,
        })
    })

    it('lets a developer override win over the remote value', () => {
        useRemoteConfigStore.setState({
            configOverrides: { fee_pq_multiplier: 5 },
        })

        expect(getMinimumFeeConfig().pqMultiplier).toBe(5n)
    })
})
