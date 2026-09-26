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

import { beforeEach, describe, it, expect } from 'vitest'
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import { rampChainAdapters } from '../chain-adapter'
import {
    hasPendingRampOrder,
    isNativeRampToken,
    rampTokenAssetId,
} from '../utils'
import { registerFakeRampAdapter } from './fakeRampAdapter'

import type { OnrampStatus, RampHistoryItem, RampToken } from '../models'

const item = (status: OnrampStatus): RampHistoryItem =>
    ({ id: `order-${status}`, status }) as RampHistoryItem

describe('hasPendingRampOrder', () => {
    it('is true when any order is pending', () => {
        expect(hasPendingRampOrder([item('completed'), item('pending')])).toBe(
            true,
        )
    })

    it('is false when no order is pending', () => {
        expect(
            hasPendingRampOrder([
                item('in_progress'),
                item('completed'),
                item('failed'),
                item('cancelled'),
            ]),
        ).toBe(false)
    })

    it('is false for an empty history', () => {
        expect(hasPendingRampOrder([])).toBe(false)
    })
})

const token = (overrides: Partial<RampToken>): RampToken =>
    ({
        id: '31566704',
        symbol: 'USDC',
        name: 'USDC',
        ...overrides,
    }) as RampToken

describe("ramp token helpers ask the network's chain adapter", () => {
    beforeEach(() => {
        rampChainAdapters.reset()
    })

    it('resolves native tokens and asset ids through the adapter', () => {
        const adapter = registerFakeRampAdapter()
        const native = token({ id: 'NATIVE', symbol: 'NAT' })

        expect(isNativeRampToken(native, 'testnet')).toBe(true)
        expect(isNativeRampToken(token({}), 'testnet')).toBe(false)
        expect(rampTokenAssetId(native, 'testnet')).toBe('0')
        expect(rampTokenAssetId(token({}), 'testnet')).toBe('31566704')
        expect(adapter.isNativeToken).toHaveBeenCalledWith(native)
    })

    it('throws when no ramp adapter is registered for the network', () => {
        expect(() => isNativeRampToken(token({}), 'mainnet')).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => rampTokenAssetId(token({}), 'mainnet')).toThrow(
            'No ramp adapter is registered for chain "algorand"',
        )
    })
})
