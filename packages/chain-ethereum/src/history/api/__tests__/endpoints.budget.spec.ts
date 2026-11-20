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
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { isRequestBudgetSpentError } from '@perawallet/wallet-core-shared'
import { PERA_URL } from '../../../__tests__/pera-backend'
import { ETHEREUM } from '../../../__tests__/evm-chains'
import { fetchHistoryPage } from '../endpoints'
import {
    createFirstPageCache,
    createHistoryPageBudget,
    type FirstPageCache,
    type HistoryPageBudget,
} from '../page-budget'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const budget = vi.hoisted(() => ({
    current: undefined as HistoryPageBudget | undefined,
    firstPages: undefined as FirstPageCache | undefined,
}))
vi.mock('../page-budget', async importOriginal => {
    const actual = await importOriginal<typeof import('../page-budget')>()
    return {
        ...actual,
        sharedHistoryPageBudget: () => budget.current,
        sharedFirstPageCache: () => budget.firstPages,
    }
})

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ME = '0x00000000000000000000000000000000000000aa'

const HISTORY_URL = `${PERA_URL}/api/v3/evm/:chainId/accounts/:address/transactions/`

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
    budget.firstPages = createFirstPageCache(60_000, () => 0)
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const countRequests = (status = 200): { count: number } => {
    const seen = { count: 0 }
    server.use(
        http.get(HISTORY_URL, () => {
            seen.count++
            return status === 200
                ? HttpResponse.json({ next: null, previous: null, results: [] })
                : HttpResponse.json({}, { status })
        }),
    )
    return seen
}

describe('fetchHistoryPage budget', () => {
    it('spends one unit per page and, once spent, rejects as spent without sending', async () => {
        budget.current = createHistoryPageBudget(
            () => 1,
            60_000,
            () => 0,
        )
        const requests = countRequests()

        await fetchHistoryPage(MAINNET, ETHEREUM, ME)
        const refusal = await fetchHistoryPage(MAINNET, ETHEREUM, ME, {
            cursor: 'older',
        }).catch((error: unknown) => error)

        expect(requests.count).toBe(1)
        expect(isRequestBudgetSpentError(refusal)).toBe(true)
    })

    it('sends a page one the backend still has cached without spending a unit', async () => {
        budget.current = createHistoryPageBudget(
            () => 1,
            60_000,
            () => 0,
        )
        const requests = countRequests()

        await fetchHistoryPage(MAINNET, ETHEREUM, ME)
        await fetchHistoryPage(MAINNET, ETHEREUM, ME)

        expect(requests.count).toBe(2)
        expect(budget.current.hasRoom()).toBe(false)
    })

    it('charges a page one for another asset filter, which the backend caches apart', async () => {
        budget.current = createHistoryPageBudget(
            () => 1,
            60_000,
            () => 0,
        )
        countRequests()

        await fetchHistoryPage(MAINNET, ETHEREUM, ME)
        const refusal = await fetchHistoryPage(
            MAINNET,
            ETHEREUM,
            ME,
            undefined,
            {
                caip19AssetId: 'eip155:1/slip44:60',
            },
        ).catch((error: unknown) => error)

        expect(isRequestBudgetSpentError(refusal)).toBe(true)
    })

    it('charges a page one again after a failed read, which the backend did not cache', async () => {
        budget.current = createHistoryPageBudget(
            () => 2,
            60_000,
            () => 0,
        )
        countRequests(500)

        await fetchHistoryPage(MAINNET, ETHEREUM, ME).catch(() => undefined)
        await fetchHistoryPage(MAINNET, ETHEREUM, ME).catch(() => undefined)

        expect(budget.current.hasRoom()).toBe(false)
    })

    it('spends nothing for a read aborted before it was sent', async () => {
        budget.current = createHistoryPageBudget(
            () => 1,
            60_000,
            () => 0,
        )
        const aborted = new AbortController()
        aborted.abort()

        await expect(
            fetchHistoryPage(MAINNET, ETHEREUM, ME, undefined, {
                signal: aborted.signal,
            }),
        ).rejects.toThrow()

        expect(budget.current.hasRoom()).toBe(true)
    })
})
