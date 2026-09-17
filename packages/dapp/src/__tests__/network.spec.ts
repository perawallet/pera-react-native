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

import { describe, expect, it } from 'vitest'
import { getNetworkConfig, Networks } from '@perawallet/wallet-core-config'
import { resolveReportedNetwork } from '../network'

describe('resolveReportedNetwork', () => {
    it('passes a baked network through', () => {
        expect(resolveReportedNetwork(Networks.mainnet, undefined)).toBe(
            Networks.mainnet,
        )
        expect(resolveReportedNetwork(Networks.testnet, 'ignored')).toBe(
            Networks.testnet,
        )
    })
    it('maps a custom network onto the baked network sharing its genesis hash', () => {
        const hash = getNetworkConfig(Networks.testnet).genesisHash
        expect(resolveReportedNetwork(Networks.custom, hash)).toBe(
            Networks.testnet,
        )
    })
    it('refuses a custom network whose genesis hash matches no baked network', () => {
        expect(
            resolveReportedNetwork(Networks.custom, 'not-a-real-hash'),
        ).toBeUndefined()
        expect(
            resolveReportedNetwork(Networks.custom, undefined),
        ).toBeUndefined()
        expect(resolveReportedNetwork(Networks.custom, '')).toBeUndefined()
    })
})
