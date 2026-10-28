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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    migrations,
    runMigrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { assessSiteSafety } from '../assess'
import { ensurePhishingListsSeeded } from '../seed'
import { usePhishingListStore } from '../store/store'
import { FIXTURE_SNAPSHOT } from './fixtures'

const database = vi.hoisted(() => ({ current: null as Database | null }))
vi.mock('@perawallet/wallet-core-database', async importOriginal => ({
    ...(await importOriginal<object>()),
    getDatabase: () => database.current,
}))

describe('assessSiteSafety', () => {
    let teardown: () => void

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
        teardown()
        vi.unstubAllGlobals()
    })

    it.each([
        ['an exact entry', 'https://bundled-phish.example'],
        [
            'a subdomain of an entry',
            'https://app.bundled-phish.example/connect',
        ],
        ['an entry from the second list', 'https://bundled-dot.example'],
    ])('blocks %s', async (_case, url) => {
        expect(await assessSiteSafety({ urls: [url] })).toMatchObject({
            kind: 'blocked',
            reason: 'phishing-list',
        })
    })

    it('lets an allowed domain through, and never vouches for it', async () => {
        await database.current!.run(
            "INSERT INTO phishing_list_domains (source, generation, kind, domain) VALUES ('metamask', " +
                usePhishingListStore.getState().sources.metamask!.generation +
                ", 'deny', 'allowed.example')",
        )

        expect(
            await assessSiteSafety({ urls: ['https://allowed.example'] }),
        ).toEqual({ kind: 'clear' })
    })

    it('blocks what WalletConnect Verify reports as a scam', async () => {
        expect(
            await assessSiteSafety({
                urls: ['https://clean.example'],
                isFlaggedByWalletConnectVerify: true,
            }),
        ).toEqual({
            kind: 'blocked',
            host: 'clean.example',
            reason: 'walletconnect-verify',
        })
    })

    it('flags a look-alike and names the site it imitates', async () => {
        expect(
            await assessSiteSafety({ urls: ['https://uniswap-app.org'] }),
        ).toEqual({
            kind: 'look-alike',
            host: 'uniswap-app.org',
            imitates: { name: 'Uniswap', domain: 'uniswap.org' },
        })
    })

    it('matches against the targets a list adds', async () => {
        expect(
            await assessSiteSafety({
                urls: ['https://cryptokitties-claim.io'],
            }),
        ).toMatchObject({
            kind: 'look-alike',
            imitates: { domain: 'cryptokitties.co' },
        })
    })

    it('reports the worst result across the urls it is given', async () => {
        expect(
            await assessSiteSafety({
                urls: [
                    'https://uniswap.org',
                    'https://uniswap-app.org',
                    'https://bundled-phish.example',
                ],
            }),
        ).toMatchObject({ kind: 'blocked', host: 'bundled-phish.example' })
    })

    it('is clear for an unlisted site or no url at all', async () => {
        expect(
            await assessSiteSafety({ urls: ['https://uniswap.org'] }),
        ).toEqual({ kind: 'clear' })
        expect(await assessSiteSafety({ urls: [undefined, null] })).toEqual({
            kind: 'clear',
        })
    })

    it('still flags look-alikes when the lists cannot be read', async () => {
        database.current = null

        expect(
            await assessSiteSafety({ urls: ['https://uniswap-app.org'] }),
        ).toMatchObject({ kind: 'look-alike' })
    })

    it('sends nothing over the network', async () => {
        const fetchSpy = vi.fn()
        vi.stubGlobal('fetch', fetchSpy)

        await assessSiteSafety({
            urls: ['https://bundled-phish.example', 'https://uniswap-app.org'],
        })

        expect(fetchSpy).not.toHaveBeenCalled()
    })
})
