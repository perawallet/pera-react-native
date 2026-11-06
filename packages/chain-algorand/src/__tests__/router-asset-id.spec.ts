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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    algorandAssetIdOfRouterId,
    algorandRouterAssetId,
} from '../router-asset-id'

const MAINNET: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const TESTNET: ChainScope = { chainId: 'algorand', networkId: 'testnet' }
const MAINNET_CAIP2 = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'

describe('algorandRouterAssetId', () => {
    it('writes an ASA as a CAIP-19 id under the network', () => {
        expect(algorandRouterAssetId('31566704', MAINNET)).toBe(
            `${MAINNET_CAIP2}/asa:31566704`,
        )
    })
})

describe('algorandAssetIdOfRouterId', () => {
    it.each(['0', '31566704'])('round-trips asset %s', assetId => {
        const routerId = algorandRouterAssetId(assetId, MAINNET)

        expect(algorandAssetIdOfRouterId(routerId, MAINNET)).toBe(assetId)
    })

    it('is null for another network of the chain', () => {
        const mainnetId = algorandRouterAssetId('31566704', MAINNET)

        expect(algorandAssetIdOfRouterId(mainnetId, TESTNET)).toBeNull()
    })

    it.each([
        ['another chain', 'eip155:1/slip44:60'],
        ['a leading zero', `${MAINNET_CAIP2}/asa:01`],
        ['the SLIP-44 form of ALGO', `${MAINNET_CAIP2}/slip44:283`],
        ['no reference', `${MAINNET_CAIP2}/asa:`],
        ['no namespace', MAINNET_CAIP2],
    ])('is null for %s', (_name, routerId) => {
        expect(algorandAssetIdOfRouterId(routerId, MAINNET)).toBeNull()
    })
})
