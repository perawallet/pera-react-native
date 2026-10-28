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
import { setupServer } from 'msw/node'
import {
    migrations,
    runMigrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { mockPhishingListSources } from '../api/msw-handlers'
import { findListedAddresses, findListedDomains } from '../db/repository'
import { refreshPhishingLists } from '../refresh'
import { ensurePhishingListsSeeded } from '../seed'
import { PHISHING_LIST_SOURCES } from '../sources'
import { selectActiveGenerations, usePhishingListStore } from '../store/store'
import {
    BUNDLED_SCAM_ADDRESS,
    evmAddressList,
    FIXTURE_SNAPSHOT,
    hostList,
    mewDarklist,
    metaMaskConfig,
    polkadotList,
} from './fixtures'

const database = vi.hoisted(() => ({ current: null as Database | null }))
vi.mock('@perawallet/wallet-core-database', async importOriginal => ({
    ...(await importOriginal<object>()),
    getDatabase: () => database.current,
}))

const server = setupServer()
const META_MASK_DENY = [...hostList(50_000, 'mm'), 'fresh-phish.example']
const POLKADOT_DENY = hostList(20_000, 'dot')
const FRESH_SCAM_ADDRESS = '0x00000000000000000000000000000000000fffff'
const DARKLIST = [...evmAddressList(500), FRESH_SCAM_ADDRESS]

const isListed = async (domain: string): Promise<boolean> => {
    const { denied } = await findListedDomains({
        generations: selectActiveGenerations(usePhishingListStore.getState()),
        domains: [domain],
    })
    return denied.length > 0
}

const isAddressListed = async (address: string): Promise<boolean> => {
    const listed = await findListedAddresses({
        generations: selectActiveGenerations(usePhishingListStore.getState()),
        addresses: [address.toLowerCase()],
    })
    return listed.length > 0
}

describe('refreshPhishingLists', () => {
    let teardown: () => void

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
    afterAll(() => server.close())

    beforeEach(async () => {
        const test = createTestDatabase()
        database.current = test.db
        teardown = test.teardown
        await runMigrations(test.db, migrations)
        usePhishingListStore.getState().resetState()
        await ensurePhishingListsSeeded({
            loadSnapshot: async () => FIXTURE_SNAPSHOT,
        })
    })

    afterEach(() => {
        server.resetHandlers()
        teardown()
    })

    it('replaces the bundled copy with a good download', async () => {
        server.use(
            ...mockPhishingListSources({
                metamask: {
                    body: metaMaskConfig({ deny: META_MASK_DENY }),
                    etag: '"v1"',
                },
                polkadot: { body: polkadotList(POLKADOT_DENY) },
                'mew-darklist': { body: mewDarklist(DARKLIST) },
            }),
        )

        const outcomes = await refreshPhishingLists({ now: () => 1_000 })

        expect(outcomes).toEqual({
            metamask: 'updated',
            polkadot: 'updated',
            'mew-darklist': 'updated',
        })
        expect(await isAddressListed(FRESH_SCAM_ADDRESS)).toBe(true)
        expect(await isAddressListed(BUNDLED_SCAM_ADDRESS)).toBe(false)
        expect(await isListed('fresh-phish.example')).toBe(true)
        expect(await isListed('bundled-phish.example')).toBe(false)
        expect(usePhishingListStore.getState().sources.metamask).toMatchObject({
            etag: '"v1"',
            refreshedAt: 1_000,
            origin: 'downloaded',
        })
        const remaining = await database.current!.all(
            "SELECT DISTINCT generation FROM phishing_list_domains WHERE source = 'metamask'",
        )
        expect(remaining).toHaveLength(1)
    }, 30_000)

    it('keeps the copy on a 304 and records the check', async () => {
        usePhishingListStore.getState().activateGeneration('metamask', {
            ...usePhishingListStore.getState().sources.metamask!,
            etag: '"v1"',
        })
        server.use(
            ...mockPhishingListSources({
                metamask: { status: 304 },
                polkadot: { status: 304 },
            }),
        )
        const before = usePhishingListStore.getState().sources.metamask!

        const outcomes = await refreshPhishingLists({ now: () => 2_000 })

        expect(outcomes.metamask).toBe('unchanged')
        expect(usePhishingListStore.getState().sources.metamask).toEqual({
            ...before,
            refreshedAt: 2_000,
        })
        expect(await isListed('bundled-phish.example')).toBe(true)
    })

    it('records an identical download as a check, without rewriting the lists', async () => {
        server.use(
            ...mockPhishingListSources({
                metamask: { body: metaMaskConfig({ deny: META_MASK_DENY }) },
                polkadot: { status: 304 },
            }),
        )
        await refreshPhishingLists({ now: () => 1_000 })
        const first = usePhishingListStore.getState().sources.metamask!

        const outcomes = await refreshPhishingLists({ now: () => 2_000 })

        expect(outcomes.metamask).toBe('unchanged')
        expect(usePhishingListStore.getState().sources.metamask).toEqual({
            ...first,
            refreshedAt: 2_000,
        })
    }, 30_000)

    it('sends the stored ETag only when there is one', async () => {
        usePhishingListStore.getState().activateGeneration('metamask', {
            ...usePhishingListStore.getState().sources.metamask!,
            etag: '"v1"',
        })
        const fetchSpy = vi.fn(
            async (_input: string | URL | Request, _init?: RequestInit) =>
                new Response(null, { status: 304 }),
        )

        await refreshPhishingLists({ fetch: fetchSpy })

        const headersFor = (url: string) =>
            fetchSpy.mock.calls.find(([input]) => input === url)?.[1]?.headers
        expect(headersFor(PHISHING_LIST_SOURCES[0]!.url)).toEqual({
            'If-None-Match': '"v1"',
        })
        expect(headersFor(PHISHING_LIST_SOURCES[1]!.url)).toBeUndefined()
    })

    it.each([
        ['a server error', { status: 500 }, 'failed'],
        ['malformed JSON', { malformed: true as const }, 'malformed'],
        ['a schema mismatch', { body: { unexpected: true } }, 'malformed'],
        [
            'a truncated list',
            { body: metaMaskConfig({ deny: hostList(10, 'mm') }) },
            'malformed',
        ],
    ])(
        'keeps the previous lists after %s',
        async (_case, response, outcome) => {
            server.use(
                ...mockPhishingListSources({
                    metamask: response,
                    polkadot: { status: 304 },
                }),
            )
            const before = usePhishingListStore.getState().sources.metamask

            const outcomes = await refreshPhishingLists()

            expect(outcomes.metamask).toBe(outcome)
            expect(usePhishingListStore.getState().sources.metamask).toEqual(
                before,
            )
            expect(await isListed('bundled-phish.example')).toBe(true)
        },
    )

    it('keeps the previous lists when the network fails', async () => {
        const outcomes = await refreshPhishingLists({
            fetch: async () => {
                throw new TypeError('Network request failed')
            },
        })

        expect(outcomes).toEqual({
            metamask: 'failed',
            polkadot: 'failed',
            'mew-darklist': 'failed',
        })
        expect(await isListed('bundled-phish.example')).toBe(true)
        expect(await isListed('bundled-dot.example')).toBe(true)
        expect(await isAddressListed(BUNDLED_SCAM_ADDRESS)).toBe(true)
    })

    it('updates one source when the other fails', async () => {
        server.use(
            ...mockPhishingListSources({
                metamask: { status: 503 },
                polkadot: { body: polkadotList(POLKADOT_DENY) },
                'mew-darklist': { status: 503 },
            }),
        )

        const outcomes = await refreshPhishingLists()

        expect(outcomes).toEqual({
            metamask: 'failed',
            polkadot: 'updated',
            'mew-darklist': 'failed',
        })
        expect(await isListed('bundled-phish.example')).toBe(true)
        expect(await isListed('dot0.example')).toBe(true)
        expect(await isListed('bundled-dot.example')).toBe(false)
    }, 30_000)

    it('keeps the current darklist when a download is truncated', async () => {
        server.use(
            ...mockPhishingListSources({
                metamask: { status: 304 },
                polkadot: { status: 304 },
                'mew-darklist': {
                    body: mewDarklist([FRESH_SCAM_ADDRESS]),
                },
            }),
        )

        const outcomes = await refreshPhishingLists()

        expect(outcomes['mew-darklist']).toBe('malformed')
        expect(await isAddressListed(BUNDLED_SCAM_ADDRESS)).toBe(true)
        expect(await isAddressListed(FRESH_SCAM_ADDRESS)).toBe(false)
    })

    it('only ever requests the fixed source URLs', async () => {
        const fetchSpy = vi.fn(
            async (_input: string | URL | Request, _init?: RequestInit) =>
                new Response(null, { status: 304 }),
        )

        await refreshPhishingLists({ fetch: fetchSpy })

        const requested = fetchSpy.mock.calls.map(([input]) => input)
        expect(requested.sort()).toEqual(
            PHISHING_LIST_SOURCES.map(source => source.url).sort(),
        )
        for (const url of requested) {
            expect(new URL(String(url)).search).toBe('')
        }
    })
})
