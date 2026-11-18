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

// An Algorand address shows its NFD name only once the NFD application on
// chain confirms it: the real adapter, the real registry client and algod
// reads, with only the network answering from MSW.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { generateAccount } from 'algosdk'
import { server } from '@test-utils/msw-server'
import {
    createQueryClientWrapper,
    renderHook,
    waitFor,
} from '@test-utils/render'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    getNameByAddress,
    useNameForAddressQuery,
} from '@perawallet/wallet-core-names'
import { mockAddressNames } from '@perawallet/wallet-core-names/test-handlers'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const APP_ID = 1234

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')

const newAccount = () => {
    const { addr } = generateAccount()
    return { address: addr.toString(), publicKey: addr.publicKey }
}

const ALICE = newAccount()
const OTHER = newAccount()

let algodRequests = 0
let isAlgodDown = false

type NfdFixture = { name: string; owner: Uint8Array; verified?: Uint8Array[] }

const serveNfd = ({ name, owner, verified = [] }: NfdFixture) =>
    server.use(
        http.get('https://api.nf.domains/nfd/:name', () =>
            HttpResponse.json({ appID: APP_ID }),
        ),
        http.get('*/v2/applications/:appId', () => {
            algodRequests++
            if (isAlgodDown) return new HttpResponse(null, { status: 503 })
            return HttpResponse.json({
                params: {
                    'global-state': [
                        {
                            key: b64('i.name'),
                            value: { type: 1, bytes: b64(name) },
                        },
                        {
                            key: b64('i.owner.a'),
                            value: {
                                type: 1,
                                bytes: Buffer.from(owner).toString('base64'),
                            },
                        },
                    ],
                },
            })
        }),
        http.get('*/v2/applications/:appId/boxes', () =>
            HttpResponse.json({
                boxes: verified.length ? [{ name: b64('v.caAlgo.0.as') }] : [],
            }),
        ),
        http.get('*/v2/applications/:appId/box', () =>
            HttpResponse.json({
                value: Buffer.concat(verified).toString('base64'),
            }),
        ),
    )

// Answers as the backend does: the name it holds for each address asked.
const serveBackendNames = (names: Record<string, string>) =>
    server.use(
        mockAddressNames({
            response: body => ({
                results: body.addresses.map(address => ({
                    address,
                    name: names[address]
                        ? { name: names[address], source: 'nfd', image: null }
                        : null,
                })),
            }),
        }),
    )

const lookup = (address: string) =>
    renderHook(() => useNameForAddressQuery(SCOPE, address), {
        wrapper: createQueryClientWrapper(),
    })

describe('Flow: NFD names for Algorand addresses', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        algodRequests = 0
        isAlgodDown = false
    })

    it('Given the backend names an address alice.algo and the NFD is owned by it, when it is looked up, then the name shows', async () => {
        serveBackendNames({ [ALICE.address]: 'alice.algo' })
        serveNfd({ name: 'alice.algo', owner: ALICE.publicKey })

        const { result } = lookup(ALICE.address)

        await waitFor(
            () => expect(result.current.data.at(0)?.name).toBe('alice.algo'),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
    })

    it('Given the NFD lists the address as verified without owning it, when it is looked up, then the name shows', async () => {
        serveBackendNames({ [ALICE.address]: 'alice.algo' })
        serveNfd({
            name: 'alice.algo',
            owner: OTHER.publicKey,
            verified: [ALICE.publicKey],
        })

        const { result } = lookup(ALICE.address)

        await waitFor(
            () => expect(result.current.data.at(0)?.name).toBe('alice.algo'),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
    })

    it('Given the backend names an address that the NFD neither owns nor lists, when it is looked up, then no name shows and the miss is cached', async () => {
        serveBackendNames({ [ALICE.address]: 'alice.algo' })
        serveNfd({ name: 'alice.algo', owner: OTHER.publicKey })

        const { result } = lookup(ALICE.address)

        await waitFor(
            async () =>
                expect(
                    await getNameByAddress({
                        address: ALICE.address,
                        scope: SCOPE,
                    }),
                ).toMatchObject({ name: null }),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(result.current.data).toEqual([])
    })

    it('Given algod cannot be read, when the address is looked up twice, then nothing is cached as no name and the node is not asked again', async () => {
        isAlgodDown = true
        serveBackendNames({ [ALICE.address]: 'alice.algo' })
        serveNfd({ name: 'alice.algo', owner: ALICE.publicKey })

        const first = lookup(ALICE.address)
        await waitFor(
            () => expect(first.result.current.isPending).toBe(false),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        const askedOnce = algodRequests
        const second = lookup(ALICE.address)
        await waitFor(
            () => expect(second.result.current.isPending).toBe(false),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )

        expect(askedOnce).toBeGreaterThan(0)
        expect(algodRequests).toBe(askedOnce)
        expect(second.result.current.data).toEqual([])
        expect(
            await getNameByAddress({ address: ALICE.address, scope: SCOPE }),
        ).toBeNull()
    })
})
