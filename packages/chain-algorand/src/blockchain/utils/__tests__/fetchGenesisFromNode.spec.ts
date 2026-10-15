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

import { describe, test, expect, vi } from 'vitest'
import { setAlgorandChainContext } from '../../../chain-context'
import { testChainContext } from '../../../__tests__/context'
import { fetchGenesisFromNode } from '../fetchGenesisFromNode'

describe('fetchGenesisFromNode', () => {
    test('reads both genesis fields from the node', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
            Promise.resolve(
                new Response(
                    JSON.stringify({
                        'genesis-hash': 'HASH=',
                        'genesis-id': 'dockernet-v1',
                    }),
                    { status: 200 },
                ),
            ),
        )

        await expect(
            fetchGenesisFromNode('http://10.0.0.5:4001'),
        ).resolves.toEqual({ genesisHash: 'HASH=', genesisId: 'dockernet-v1' })
    })

    test('normalizes a trailing slash rather than producing a double slash', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
            Promise.resolve(
                new Response(
                    JSON.stringify({
                        'genesis-hash': 'H',
                        'genesis-id': 'g',
                    }),
                    { status: 200 },
                ),
            ),
        )

        await fetchGenesisFromNode('http://10.0.0.5:4001/')

        expect(fetchSpy).toHaveBeenCalledWith(
            'http://10.0.0.5:4001/v2/transactions/params',
            expect.anything(),
        )
    })

    test("bounds the probe by the registered context's read ceiling", async () => {
        setAlgorandChainContext({
            ...testChainContext(),
            timeouts: { readMs: 4_321, submitMs: 1 },
        })
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({ 'genesis-hash': 'H', 'genesis-id': 'g' }),
                { status: 200 },
            ),
        )
        const timeout = vi.spyOn(AbortSignal, 'timeout')

        await fetchGenesisFromNode('http://10.0.0.5:4001')

        expect(timeout).toHaveBeenCalledWith(4_321)
    })

    test('sends the API token only when one is given', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
            Promise.resolve(
                new Response(
                    JSON.stringify({
                        'genesis-hash': 'H',
                        'genesis-id': 'g',
                    }),
                    { status: 200 },
                ),
            ),
        )

        await fetchGenesisFromNode('http://10.0.0.5:4001', 'secret')
        await fetchGenesisFromNode('http://10.0.0.5:4001')

        expect(fetchSpy.mock.calls[0]?.[1]?.headers).toEqual({
            'X-Algo-API-Token': 'secret',
        })
        expect(fetchSpy.mock.calls[1]?.[1]?.headers).toEqual({})
    })

    test('rejects when the node responds non-OK', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('nope', { status: 500 }),
        )

        await expect(
            fetchGenesisFromNode('http://10.0.0.5:4001'),
        ).rejects.toThrow()
    })
})
