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
import { isChainIdAcceptable } from '../chain'

// The per-network chain-id table lives in `./expectedChainId` and is tested
// there; these cases cover only what this wrapper adds on top of it — the
// wildcard, the missing-id rejection, and the exact-match comparison.
describe('isChainIdAcceptable', () => {
    it('accepts the wildcard chain id on any network', () => {
        expect(isChainIdAcceptable(AlgorandChainId.all, Networks.mainnet)).toBe(
            true,
        )
        expect(isChainIdAcceptable(AlgorandChainId.all, Networks.testnet)).toBe(
            true,
        )
    })

    it('accepts a chain id matching the active network', () => {
        expect(
            isChainIdAcceptable(AlgorandChainId.testnet, Networks.testnet),
        ).toBe(true)
    })

    it('rejects a chain id for the other network', () => {
        expect(
            isChainIdAcceptable(AlgorandChainId.mainnet, Networks.testnet),
        ).toBe(false)
    })

    it('rejects a missing chain id', () => {
        expect(isChainIdAcceptable(undefined, Networks.mainnet)).toBe(false)
    })
})
