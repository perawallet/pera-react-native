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
import {
    AlgorandRemoteConfigKeys,
    algorandRemoteConfigDefaults,
    readAlgorandFeeConfig,
} from '../remote-config'

const getNumberValueMock = vi.fn()
const remoteConfig = { getNumberValue: getNumberValueMock }

describe('algorandRemoteConfigDefaults', () => {
    // The key names are the wire contract with remote config.
    it('keeps every key name and bundled default', () => {
        expect(AlgorandRemoteConfigKeys).toEqual({
            fee_min_txn_fee: 'fee_min_txn_fee',
            fee_pq_multiplier: 'fee_pq_multiplier',
            fee_asset_mbr: 'fee_asset_mbr',
            fee_base_account_mbr: 'fee_base_account_mbr',
            enable_quantum_swap: 'enable_quantum_swap',
            enable_quantum_dapp_warning: 'enable_quantum_dapp_warning',
            enable_ssl_pinning_algod: 'enable_ssl_pinning_algod',
        })
        expect(algorandRemoteConfigDefaults).toEqual({
            fee_min_txn_fee: 1000,
            fee_pq_multiplier: 3,
            fee_asset_mbr: 100_000,
            fee_base_account_mbr: 100_000,
            enable_quantum_swap: false,
            enable_quantum_dapp_warning: true,
            enable_ssl_pinning_algod: false,
        })
    })
})

beforeEach(() => {
    getNumberValueMock.mockReset()
    // Default: echo the provided fallback, i.e. remote config has no override.
    getNumberValueMock.mockImplementation(
        (_key: string, fallback: number) => fallback,
    )
})

describe('readAlgorandFeeConfig', () => {
    it('returns remote-config values converted to bigint', () => {
        const values: Record<string, number> = {
            fee_min_txn_fee: 2000,
            fee_pq_multiplier: 5,
            fee_asset_mbr: 200000,
            fee_base_account_mbr: 300000,
        }
        getNumberValueMock.mockImplementation((key: string) => values[key])

        expect(readAlgorandFeeConfig(remoteConfig)).toEqual({
            minTxnFee: 2000n,
            pqMultiplier: 5n,
            assetMbr: 200000n,
            baseAccountMbr: 300000n,
        })
    })

    it('returns the hardcoded fallbacks when remote config has no overrides', () => {
        expect(readAlgorandFeeConfig(remoteConfig)).toEqual({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
            assetMbr: 100000n,
            baseAccountMbr: 100000n,
        })
    })

    it('requests every key with its documented fallback', () => {
        readAlgorandFeeConfig(remoteConfig)

        expect(getNumberValueMock).toHaveBeenCalledWith('fee_min_txn_fee', 1000)
        expect(getNumberValueMock).toHaveBeenCalledWith('fee_pq_multiplier', 3)
        expect(getNumberValueMock).toHaveBeenCalledWith('fee_asset_mbr', 100000)
        expect(getNumberValueMock).toHaveBeenCalledWith(
            'fee_base_account_mbr',
            100000,
        )
    })

    it('falls back to the constants when remote config returns non-finite values', () => {
        getNumberValueMock.mockReturnValue(Number.NaN)

        expect(readAlgorandFeeConfig(remoteConfig)).toEqual({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
            assetMbr: 100000n,
            baseAccountMbr: 100000n,
        })
    })

    it('falls back to the constants when remote config returns zero or negative values', () => {
        getNumberValueMock.mockReturnValue(-5)

        expect(readAlgorandFeeConfig(remoteConfig)).toEqual({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
            assetMbr: 100000n,
            baseAccountMbr: 100000n,
        })
    })

    it('rounds fractional remote-config values to the nearest integer', () => {
        getNumberValueMock.mockImplementation((key: string, f: number) =>
            key === 'fee_min_txn_fee' ? 1500.6 : f,
        )

        expect(readAlgorandFeeConfig(remoteConfig).minTxnFee).toBe(1501n)
    })
})
