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

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { TEST_RPC_URL, testChainContext } from '../../../__tests__/context'
import { readErc20 } from '../erc20'
import { erc20CallResponder, evmRpcHandlers } from '../../msw-handlers'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const server = setupServer(
    ...evmRpcHandlers({
        rpcUrl: TEST_RPC_URL,
        responses: {
            eth_call: erc20CallResponder({
                [USDC]: {
                    name: 'USD Coin',
                    symbol: 'USDC',
                    decimals: 6,
                    totalSupply: 10n ** 12n,
                },
            }),
        },
    }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('readErc20', () => {
    it("reads the token's metadata as an unverified PeraAsset with a checksummed id", async () => {
        const asset = await readErc20(
            testChainContext(),
            USDC.toLowerCase(),
            SCOPE,
        )

        expect(asset).toMatchObject({
            assetId: USDC,
            name: 'USD Coin',
            unitName: 'USDC',
            decimals: 6,
            peraMetadata: { verificationTier: 'unverified' },
        })
        expect(asset.totalSupply.toFixed()).toBe('1000000000000')
        // Left unset so persisting the read keeps the user's own flags.
        expect(asset.peraMetadata).not.toHaveProperty('isFavorited')
        expect(asset.peraMetadata).not.toHaveProperty('isPriceAlertEnabled')
    })

    it('rejects when the contract reverts', async () => {
        await expect(
            readErc20(
                testChainContext(),
                '0x00000000000000000000000000000000000000cc',
                SCOPE,
            ),
        ).rejects.toThrow()
    })
})
