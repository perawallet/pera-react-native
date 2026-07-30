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

import { describe, it, expect } from 'vitest'
import { Networks } from '@perawallet/wallet-core-shared'
import { AlgorandChainId } from '../../models'
import {
    EXPECTED_CHAIN_ID_BY_NETWORK,
    getExpectedChainId,
} from '../expectedChainId'

describe('getExpectedChainId', () => {
    it('resolves mainnet to its registered chain id', () => {
        expect(getExpectedChainId(Networks.mainnet)).toBe(
            AlgorandChainId.mainnet,
        )
    })

    it('resolves testnet to its registered chain id', () => {
        expect(getExpectedChainId(Networks.testnet)).toBe(
            AlgorandChainId.testnet,
        )
    })

    it('resolves betanet to its OWN registered chain id, not mainnet/testnet', () => {
        // Regression case: betanet has a real registered CAIP id
        // (416_003) — the union widening alone left every network past
        // testnet computed as `network === testnet ? testnet : mainnet`,
        // so a correctly-configured betanet dApp presenting 416_003 was
        // rejected outright.
        expect(getExpectedChainId(Networks.betanet)).toBe(
            AlgorandChainId.betanet,
        )
        expect(getExpectedChainId(Networks.betanet)).not.toBe(
            AlgorandChainId.mainnet,
        )
    })

    it('resolves custom to TestNet id — an arbitrary node has no registered CAIP id of its own', () => {
        // custom has no registered CAIP id of its own, so it maps to
        // TestNet's — a dApp connects as though the wallet were on TestNet.
        // Before the equivalent fix for fnet/localnet, an un-registered
        // network resolved to MainNet's id instead (the ternary's default
        // branch), so a dApp presenting MainNet's 416_001 was WRONGLY
        // accepted while on a network with no id of its own.
        expect(getExpectedChainId(Networks.custom)).toBe(
            AlgorandChainId.testnet,
        )
    })

    it('maps every network, with custom borrowing testnet id', () => {
        expect(EXPECTED_CHAIN_ID_BY_NETWORK).toEqual({
            mainnet: AlgorandChainId.mainnet,
            testnet: AlgorandChainId.testnet,
            betanet: AlgorandChainId.betanet,
            custom: AlgorandChainId.testnet,
        })
    })
})
