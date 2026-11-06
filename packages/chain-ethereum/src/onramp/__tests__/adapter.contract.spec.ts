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
import { rampContractTests } from '@perawallet/wallet-core-onramp/testing'
import {
    eip155IdOf,
    EVM_TEST_CHAINS,
    evmScopeOf,
} from '../../__tests__/evm-chains'
import { createEvmRampAdapter } from '../adapter'

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const ALGORAND_MAINNET = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'

describe.each(EVM_TEST_CHAINS)('the $row.id ramp adapter', chain => {
    const eip155 = eip155IdOf(chain)
    const otherEip155 = eip155 + 1

    rampContractTests(() => createEvmRampAdapter(chain), {
        scope: evmScopeOf(chain),
        native: {
            routerAssetId: `eip155:${eip155}/slip44:${chain.row.nativeAsset.slip44}`,
            assetId: chain.nativeAsset.assetId,
        },
        nonNative: {
            routerAssetId: `eip155:${eip155}/erc20:${TOKEN.toLowerCase()}`,
            assetId: TOKEN,
        },
        foreignRouterAssetId: `${ALGORAND_MAINNET}/asa:31566704`,
        malformedRouterAssetIds: [
            '',
            `eip155:${eip155}`,
            `eip155:${eip155}/erc20:`,
            `eip155:${eip155}/erc20:0x1234`,
            `eip155:${eip155}/slip44:0`,
            `eip155:${otherEip155}/erc20:${TOKEN.toLowerCase()}`,
        ],
    })

    it('has no receive step to prepare', () => {
        expect(createEvmRampAdapter(chain).useEnsureCanReceive).toBeUndefined()
    })

    it('limits Buy to the router destinations', () => {
        expect(createEvmRampAdapter(chain).isBuyLimitedToDestinations).toBe(
            true,
        )
    })
})
