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
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM } from '../../../__tests__/evm-chains'
import { evmSimulationResponseSchema } from '../schema'
import { toEvmTransactionSimulation } from '../transformers'
import {
    simulationRevertedResponse,
    simulationSuccessResponse,
    simulationUnavailableResponse,
} from '../msw-handlers'

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const COLLECTION = '0x1111111111111111111111111111111111111111'
const UNKNOWN_SPENDER = '0x2222222222222222222222222222222222222222'

const read = (response: ReturnType<typeof simulationSuccessResponse>) =>
    toEvmTransactionSimulation(
        evmSimulationResponseSchema.parse(response),
        MAINNET,
        ETHEREUM,
    )

describe('toEvmTransactionSimulation', () => {
    it('reads native and token deltas as signed Decimal base units under the app asset ids', () => {
        const result = read(
            simulationSuccessResponse([
                {
                    asset_id: 'eip155:1/slip44:60',
                    standard: 'native',
                    token_id: null,
                    amount: '-100000000000000000',
                },
                {
                    asset_id: `eip155:1/erc20:${USDC.toLowerCase()}`,
                    standard: 'erc20',
                    token_id: null,
                    amount: '241050501',
                },
            ]),
        )

        expect(result).toEqual({
            status: 'success',
            blockNumber: 26_347_663,
            assetChanges: [
                {
                    assetId: ETHEREUM.nativeAsset.assetId,
                    standard: 'native',
                    amount: new Decimal('-100000000000000000'),
                },
                {
                    assetId: USDC,
                    standard: 'erc20',
                    amount: new Decimal('241050501'),
                },
            ],
            approvalChanges: [],
        })
    })

    it('keys an NFT change by its contract and token id, past 2^53', () => {
        const result = read(
            simulationSuccessResponse([
                {
                    asset_id: `eip155:1/erc721:${COLLECTION}`,
                    standard: 'erc721',
                    token_id: '9007199254740993',
                    amount: '-1',
                },
                {
                    asset_id: `eip155:1/erc1155:${COLLECTION}`,
                    standard: 'erc1155',
                    token_id: '7',
                    amount: '3',
                },
            ]),
        )

        expect(result.status === 'success' && result.assetChanges).toEqual([
            {
                assetId:
                    '0x1111111111111111111111111111111111111111/9007199254740993',
                standard: 'erc721',
                amount: new Decimal(-1),
            },
            {
                assetId: '0x1111111111111111111111111111111111111111/7',
                standard: 'erc1155',
                amount: new Decimal(3),
            },
        ])
    })

    it('reads an unlimited approval with no amount and names a known spender', () => {
        const result = read(
            simulationSuccessResponse(
                [],
                [
                    {
                        contract: USDC.toLowerCase(),
                        spender: PERMIT2.toLowerCase(),
                        token_id: null,
                        collection_wide: false,
                        allowance: 'unlimited',
                    },
                ],
            ),
        )

        expect(result.status === 'success' && result.approvalChanges).toEqual([
            {
                contract: USDC,
                spender: PERMIT2,
                knownSpender: {
                    name: 'Permit2',
                    projectDomain: 'uniswap.org',
                },
                isCollectionWide: false,
            },
        ])
    })

    it('reads a limited approval, a revoke, a token approval and a collection-wide grant', () => {
        const result = read(
            simulationSuccessResponse(
                [],
                [
                    {
                        contract: USDC.toLowerCase(),
                        spender: UNKNOWN_SPENDER,
                        token_id: null,
                        collection_wide: false,
                        allowance: '5000000',
                    },
                    {
                        contract: USDC.toLowerCase(),
                        spender: UNKNOWN_SPENDER,
                        token_id: null,
                        collection_wide: false,
                        allowance: '0',
                    },
                    {
                        contract: COLLECTION,
                        spender: UNKNOWN_SPENDER,
                        token_id: '12',
                        collection_wide: false,
                        allowance: '1',
                    },
                    {
                        contract: COLLECTION,
                        spender: UNKNOWN_SPENDER,
                        token_id: null,
                        collection_wide: true,
                        allowance: 'unlimited',
                    },
                ],
            ),
        )

        const changes =
            result.status === 'success' ? result.approvalChanges : []
        expect(changes.map(c => c.amount?.toFixed())).toEqual([
            '5000000',
            '0',
            '1',
            undefined,
        ])
        expect(changes.map(c => c.tokenId)).toEqual([
            undefined,
            undefined,
            '12',
            undefined,
        ])
        expect(changes.map(c => c.isCollectionWide)).toEqual([
            false,
            false,
            false,
            true,
        ])
        expect(changes.every(c => c.knownSpender === undefined)).toBe(true)
    })

    it('reads a revert with and without a reason', () => {
        expect(
            read(
                simulationRevertedResponse(
                    'ERC20: transfer amount exceeds balance',
                ),
            ),
        ).toEqual({
            status: 'reverted',
            revertReason: 'ERC20: transfer amount exceeds balance',
        })
        expect(read(simulationRevertedResponse(null))).toEqual({
            status: 'reverted',
            revertReason: null,
        })
    })

    it('reads an unavailable answer whatever its reason', () => {
        expect(read(simulationUnavailableResponse('rate_limited'))).toEqual({
            status: 'unavailable',
        })
    })

    it("throws on another chain's asset id rather than dropping the change", () => {
        expect(() =>
            read(
                simulationSuccessResponse([
                    {
                        asset_id: `eip155:8453/erc20:${USDC.toLowerCase()}`,
                        standard: 'erc20',
                        token_id: null,
                        amount: '1',
                    },
                ]),
            ),
        ).toThrow()
    })

    it('throws on an NFT change with no token id, and on a success with no block', () => {
        expect(() =>
            read(
                simulationSuccessResponse([
                    {
                        asset_id: `eip155:1/erc721:${COLLECTION}`,
                        standard: 'erc721',
                        token_id: null,
                        amount: '1',
                    },
                ]),
            ),
        ).toThrow()
        expect(() =>
            read({ ...simulationSuccessResponse([]), block_number: null }),
        ).toThrow()
    })
})

describe('evmSimulationResponseSchema', () => {
    it('rejects an amount that is not an integer string', () => {
        expect(
            evmSimulationResponseSchema.safeParse(
                simulationSuccessResponse([
                    {
                        asset_id: 'eip155:1/slip44:60',
                        standard: 'native',
                        token_id: null,
                        amount: '1.5',
                    },
                ]),
            ).success,
        ).toBe(false)
    })
})
