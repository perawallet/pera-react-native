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
import { walletConnectSupportFor } from '../shared/chainSupport'
import { AlgorandWalletConnectChainId } from '../models'

// chain-algorand cannot import this package's `AlgorandWalletConnectChainId`
// (the dependency runs the other way, through the dApp request adapter), so
// it keeps its own copy of the numbers. This is what pins the two together:
// a value renumbered on one side without the other fails here, not silently
// in production.
describe('AlgorandWalletConnectChainId parity with the registered adapter', () => {
    const v1 = walletConnectSupportFor('mainnet')?.v1
    if (!v1) {
        throw new Error(
            'no v1 support registered — registerDappRequestAdapter.ts should have run',
        )
    }

    it.each([
        ['mainnet', AlgorandWalletConnectChainId.mainnet],
        ['testnet', AlgorandWalletConnectChainId.testnet],
        ['betanet', AlgorandWalletConnectChainId.betanet],
    ] as const)(
        "accepts %s's own AlgorandWalletConnectChainId value on that network",
        (network, chainId) => {
            expect(v1.isChainIdAcceptable(chainId, network)).toBe(true)
        },
    )

    it('accepts the 4160 wildcard on every network', () => {
        for (const network of ['mainnet', 'testnet', 'betanet', 'custom'] as const) {
            expect(
                v1.isChainIdAcceptable(AlgorandWalletConnectChainId.all, network),
            ).toBe(true)
        }
    })

    it("does not accept mainnet's id on testnet", () => {
        expect(
            v1.isChainIdAcceptable(AlgorandWalletConnectChainId.mainnet, 'testnet'),
        ).toBe(false)
    })
})
