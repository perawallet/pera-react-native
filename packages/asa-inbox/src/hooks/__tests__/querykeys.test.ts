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

import { describe, test, expect } from 'vitest'
import {
    getArc59SendSummaryQueryKey,
    getArc59AssetRequestsQueryKey,
} from '../querykeys'

describe('querykeys', () => {
    describe('getArc59SendSummaryQueryKey', () => {
        test('includes the receiver, asset id and network in the key', () => {
            const key = getArc59SendSummaryQueryKey('ADDR1', '123', 'mainnet')

            expect(key).toEqual([
                'asa-inbox',
                'arc59-send-summary',
                {
                    receiverAddress: 'ADDR1',
                    assetId: '123',
                    network: 'mainnet',
                },
            ])
        })

        test('produces different keys for different networks', () => {
            const key1 = getArc59SendSummaryQueryKey('ADDR1', '123', 'mainnet')
            const key2 = getArc59SendSummaryQueryKey('ADDR1', '123', 'testnet')

            expect(key1).not.toEqual(key2)
        })
    })

    describe('getArc59AssetRequestsQueryKey', () => {
        test('includes the address and network in the key', () => {
            const key = getArc59AssetRequestsQueryKey('ADDR1', 'mainnet')

            expect(key).toEqual([
                'asa-inbox',
                'arc59-asset-requests',
                { address: 'ADDR1', network: 'mainnet' },
            ])
        })

        test('produces different keys for different networks', () => {
            const key1 = getArc59AssetRequestsQueryKey('ADDR1', 'mainnet')
            const key2 = getArc59AssetRequestsQueryKey('ADDR1', 'testnet')

            expect(key1).not.toEqual(key2)
        })
    })
})
