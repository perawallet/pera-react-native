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

import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { setupServer } from 'msw/node'
import {
    encodeAbiParameters,
    encodeEventTopics,
    erc20Abi,
    getAddress,
    type Hex,
    type Log,
} from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    createHistoryScanBudget,
    createTokenSightings,
    receivedTokenIdsOf,
    scanReceivedTokens,
    TOKEN_SCAN_MAX_PAGES,
} from '../token-detection'
import {
    evmHistoryItem,
    peraEvmHistoryHandlers,
} from '../../history/api/msw-handlers'
import type { EvmHistoryItemResponse } from '../../history/api/schema'
import { TEST_PERA_URL } from '../../__tests__/context'
import { ETHEREUM } from '../../__tests__/evm-chains'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
        ['history'],
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ME: Hex = '0x00000000000000000000000000000000000000aa'
const OTHER: Hex = '0x00000000000000000000000000000000000000bb'
const TSLAX = '0x8aD3c73F833d3F9A523aB01476625F269aEb7Cf0'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const transferLog = (
    contract: string,
    to: Hex,
    value: bigint,
    isNft = false,
): Log => {
    const topics = encodeEventTopics({
        abi: erc20Abi,
        eventName: 'Transfer',
        args: { from: OTHER, to },
    })
    return {
        address: contract.toLowerCase(),
        // An ERC-721 Transfer indexes the token id too.
        topics: isNft ? [...topics, `0x${'1'.padStart(64, '0')}`] : topics,
        data: isNft
            ? '0x'
            : encodeAbiParameters([{ type: 'uint256' }], [value]),
    } as Log
}

const received = (
    block: number,
    contract: string,
    overrides: Partial<EvmHistoryItemResponse['token_transfers'][number]> = {},
): EvmHistoryItemResponse =>
    evmHistoryItem({
        block_number: block,
        token_transfers: [
            {
                asset_id: `eip155:1/erc20:${contract.toLowerCase()}`,
                contract: contract.toLowerCase(),
                from: OTHER,
                to: ME,
                value: '5',
                token_name: null,
                token_symbol: null,
                token_decimals: null,
                ...overrides,
            },
        ],
    })

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const history = (pages: EvmHistoryItemResponse[][]) =>
    server.use(
        ...peraEvmHistoryHandlers({
            baseUrl: TEST_PERA_URL,
            history: { [ME]: pages },
        }),
    )

const openBudget = () => createHistoryScanBudget(100, 60_000, () => 0)

describe('receivedTokenIdsOf', () => {
    it('keeps ERC-20 transfers to the address, checksummed once each', () => {
        const ids = receivedTokenIdsOf(
            [
                transferLog(TSLAX, ME, 5n),
                transferLog(TSLAX, ME, 7n),
                transferLog(USDC, ME, 1n),
            ],
            ME.toUpperCase().replace('0X', '0x'),
        )

        expect(ids).toEqual([getAddress(TSLAX), getAddress(USDC)])
    })

    it('skips zero-value transfers, other recipients and ERC-721 transfers', () => {
        const ids = receivedTokenIdsOf(
            [
                transferLog(TSLAX, ME, 0n),
                transferLog(USDC, OTHER, 5n),
                transferLog(ZERO_ADDRESS, ME, 1n, true),
            ],
            ME,
        )

        expect(ids).toEqual([])
    })
})

describe('createTokenSightings', () => {
    it('keys by chain, network and address, ignoring the address case', () => {
        const sightings = createTokenSightings()
        sightings.record(SCOPE, ME, [TSLAX.toLowerCase()])

        expect(sightings.of(SCOPE, ME.toUpperCase())).toEqual([
            getAddress(TSLAX),
        ])
        expect(sightings.of({ ...SCOPE, networkId: 'testnet' }, ME)).toEqual([])
        expect(sightings.of(SCOPE, OTHER)).toEqual([])
    })
})

describe('createHistoryScanBudget', () => {
    it('refuses once the window is spent and allows again after it resets', () => {
        let now = 0
        const budget = createHistoryScanBudget(2, 1_000, () => now)

        expect([budget.take(), budget.take(), budget.take()]).toEqual([
            true,
            true,
            false,
        ])
        now = 1_000
        expect(budget.take()).toBe(true)
    })
})

describe('scanReceivedTokens', () => {
    it('collects what the address received and ends at the newest block', async () => {
        history([
            [
                received(30, TSLAX),
                received(29, USDC, { to: OTHER }),
                received(28, USDC, { value: '0' }),
            ],
        ])

        const scan = await scanReceivedTokens(
            SCOPE,
            ETHEREUM,
            ME,
            undefined,
            openBudget(),
        )

        expect(scan).toEqual({
            tokenIds: [getAddress(TSLAX)],
            scannedBlock: 30,
        })
    })

    it("stops at the previous scan's block without reading older pages", async () => {
        history([
            [received(30, TSLAX), received(20, USDC)],
            [received(10, '0x00000000000000000000000000000000000000cc')],
        ])

        const scan = await scanReceivedTokens(
            SCOPE,
            ETHEREUM,
            ME,
            25,
            openBudget(),
        )

        expect(scan.tokenIds).toEqual([getAddress(TSLAX)])
        expect(scan.scannedBlock).toBe(30)
    })

    it('reads at most the page cap', async () => {
        const pages = Array.from(
            { length: TOKEN_SCAN_MAX_PAGES + 2 },
            (_, i) => [
                received(
                    100 - i,
                    `0x${(i + 1).toString(16).padStart(40, '0')}`,
                ),
            ],
        )
        history(pages)

        const scan = await scanReceivedTokens(
            SCOPE,
            ETHEREUM,
            ME,
            undefined,
            openBudget(),
        )

        expect(scan.tokenIds).toHaveLength(TOKEN_SCAN_MAX_PAGES)
        expect(scan.scannedBlock).toBe(100)
    })

    it('leaves the end of the scan unset when the budget runs out first', async () => {
        history([[received(30, TSLAX)], [received(20, USDC)]])

        const scan = await scanReceivedTokens(
            SCOPE,
            ETHEREUM,
            ME,
            undefined,
            createHistoryScanBudget(1, 60_000, () => 0),
        )

        expect(scan).toEqual({
            tokenIds: [getAddress(TSLAX)],
            scannedBlock: undefined,
        })
    })

    it('rejects when a page fails', async () => {
        server.use(
            ...peraEvmHistoryHandlers({
                baseUrl: TEST_PERA_URL,
                history: 502,
            }),
        )

        await expect(
            scanReceivedTokens(SCOPE, ETHEREUM, ME, undefined, openBudget()),
        ).rejects.toMatchObject({ status: 502 })
    })
})
