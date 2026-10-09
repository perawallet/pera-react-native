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

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { getNumberValueMock } = vi.hoisted(() => ({
    getNumberValueMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: () => ({
        getNumberValue: getNumberValueMock,
    }),
}))

import { useMinimumFeeConfig } from '../useMinimumFeeConfig'

describe('useMinimumFeeConfig', () => {
    it('reads the fee config from the remote config service', () => {
        getNumberValueMock.mockImplementation((key: string, f: number) =>
            key === 'fee_min_txn_fee' ? 2000 : f,
        )

        const { result } = renderHook(() => useMinimumFeeConfig())

        expect(result.current).toEqual({
            minTxnFee: 2000n,
            pqMultiplier: 3n,
            assetMbr: 100000n,
            baseAccountMbr: 100000n,
        })
    })
})
