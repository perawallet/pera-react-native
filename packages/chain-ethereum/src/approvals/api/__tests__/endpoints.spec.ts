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
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { getAddress } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM } from '../../../__tests__/evm-chains'
import { PERA_URL } from '../../../__tests__/pera-backend'
import {
    APPROVALS_MAX_PAGES,
    approvalsPath,
    fetchEvmApprovalCandidates,
} from '../endpoints'
import {
    evmAllowanceCandidate,
    evmOperatorCandidate,
    peraEvmApprovalHandlers,
} from '../msw-handlers'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
        ['approvals'],
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const OWNER = '0x00000000000000000000000000000000000000AA'

const server = setupServer()
const requested: string[] = []

beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
    server.events.on('request:start', ({ request }) => {
        const url = new URL(request.url)
        requested.push(`${url.pathname}${url.search}`)
    })
})
afterEach(() => {
    server.resetHandlers()
    requested.length = 0
})
afterAll(() => server.close())

const fetchCandidates = () => fetchEvmApprovalCandidates(SCOPE, ETHEREUM, OWNER)

describe('fetchEvmApprovalCandidates', () => {
    it("asks for the owner's approvals by lowercase address, and checksums what it reads", async () => {
        server.use(
            ...peraEvmApprovalHandlers({
                baseUrl: PERA_URL,
                approvals: {
                    [OWNER.toLowerCase()]: [
                        [
                            evmAllowanceCandidate({
                                token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                            }),
                            evmOperatorCandidate(),
                        ],
                    ],
                },
            }),
        )

        const candidates = await fetchCandidates()

        expect(requested).toEqual([approvalsPath(1, OWNER.toLowerCase())])
        expect(candidates).toEqual([
            expect.objectContaining({
                kind: 'allowance',
                token: getAddress('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
            }),
            expect.objectContaining({
                kind: 'operator',
                collectionName: 'Bored Ape Yacht Club',
            }),
        ])
    })

    it('skips a row it cannot read and keeps the rest', async () => {
        server.use(
            http.get(
                `${PERA_URL}${approvalsPath(':chainId', ':address')}`,
                () =>
                    HttpResponse.json({
                        next: null,
                        results: [
                            {
                                kind: 'allowance',
                                token: 'nope',
                                spender: 'nope',
                            },
                            { kind: 'mystery' },
                            evmOperatorCandidate({ collection_name: null }),
                        ],
                    }),
            ),
        )

        const candidates = await fetchCandidates()

        expect(candidates).toHaveLength(1)
        expect(candidates[0]).toMatchObject({ kind: 'operator' })
        expect(candidates[0]).not.toHaveProperty('collectionName')
    })

    it('reads a pair once however many pages list it', async () => {
        server.use(
            ...peraEvmApprovalHandlers({
                baseUrl: PERA_URL,
                approvals: {
                    [OWNER.toLowerCase()]: [
                        [evmAllowanceCandidate()],
                        [evmAllowanceCandidate()],
                    ],
                },
            }),
        )

        await expect(fetchCandidates()).resolves.toHaveLength(1)
        expect(requested).toHaveLength(2)
    })

    it('rejects on a cursor that never ends', async () => {
        server.use(
            http.get(
                `${PERA_URL}${approvalsPath(':chainId', ':address')}`,
                () => HttpResponse.json({ next: 'again', results: [] }),
            ),
        )

        await expect(fetchCandidates()).rejects.toThrow(/ran past/)
        expect(requested).toHaveLength(APPROVALS_MAX_PAGES)
    })

    it('rejects on a failed page, so a partial list never stands in for the whole', async () => {
        server.use(
            ...peraEvmApprovalHandlers({ baseUrl: PERA_URL, approvals: 503 }),
        )

        await expect(fetchCandidates()).rejects.toThrow()
    })
})
