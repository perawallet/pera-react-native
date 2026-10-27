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

import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import {
    EVMNET,
    EVMNET_CHAINS,
    anvilRpc,
    assertEvmnetReachable,
    assertRpcReachable,
    isAutomine,
    mine,
    rpcAt,
    setAutomine,
    txpoolCounts,
    withAutomineOff,
} from '../evmnet'

describe('evmnet', () => {
    it('matches the compose file on container, port, chain id and mode', () => {
        const compose = readFileSync(
            new URL(
                '../../../../tools/dev/evmnet.compose.yml',
                import.meta.url,
            ),
            'utf8',
        )
        const services = compose.split(/^ {2}(?=[a-z]+:$)/m).slice(2)

        const parsed = Object.fromEntries(
            services.map(block => [
                block.split(':')[0],
                {
                    container: /container_name: (\S+)/.exec(block)?.[1],
                    rpcUrl: `http://127.0.0.1:${/127\.0\.0\.1:(\d+):8545/.exec(block)?.[1]}`,
                    eip155ChainId: Number(
                        /"--chain-id"\s+- "(\d+)"/.exec(block)?.[1],
                    ),
                    optimism: block.includes('"--optimism"'),
                },
            ]),
        )

        expect(Object.keys(parsed).sort()).toEqual([...EVMNET_CHAINS].sort())
        for (const chain of EVMNET_CHAINS) {
            expect(parsed[chain]).toEqual({
                container: EVMNET[chain].container,
                rpcUrl: EVMNET[chain].rpcUrl,
                eip155ChainId: EVMNET[chain].eip155ChainId,
                optimism: chain === 'base',
            })
        }
    })

    describe.each(EVMNET_CHAINS)('%s', chain => {
        it('is reachable and serves its own chain id', async () => {
            const { blockNumber } = await assertEvmnetReachable(chain)

            expect(typeof blockNumber).toBe('bigint')
            expect(BigInt(await anvilRpc<string>(chain, 'eth_chainId'))).toBe(
                BigInt(EVMNET[chain].eip155ChainId),
            )
        })

        it('mines a block on demand', async () => {
            const before = (await assertEvmnetReachable(chain)).blockNumber

            await mine(chain, 2)

            const after = (await assertEvmnetReachable(chain)).blockNumber
            expect(after - before).toBe(2n)
        })
    })

    it('rejects a closed port with the start instructions', async () => {
        const rejection = assertRpcReachable(
            'http://127.0.0.1:1',
            'ethereum',
            EVMNET.ethereum,
        )

        await expect(rejection).rejects.toThrow(
            /evmnet is not reachable at http:\/\/127\.0\.0\.1:1[\s\S]*pnpm evmnet/,
        )
    })

    it('names the expected and served chain id when another chain answers', async () => {
        await expect(
            assertRpcReachable(EVMNET.base.rpcUrl, 'ethereum', EVMNET.ethereum),
        ).rejects.toThrow(/expected chain id 11155111.*84532/s)
    })

    it('surfaces a JSON-RPC error with its code and message', async () => {
        await expect(anvilRpc('ethereum', 'evm_noSuchMethod')).rejects.toThrow(
            /-32601/,
        )
    })

    it('restores automine and leaves nothing queued after the callback throws', async () => {
        await expect(
            withAutomineOff('ethereum', async () => {
                expect(await isAutomine('ethereum')).toBe(false)
                throw new Error('boom')
            }),
        ).rejects.toThrow('boom')

        expect(await isAutomine('ethereum')).toBe(true)
        expect(await txpoolCounts('ethereum')).toEqual({
            pending: 0,
            queued: 0,
        })
    })

    it('reports a pending transaction while automine is off, then mines it', async () => {
        const [from] = await anvilRpc<string[]>('ethereum', 'eth_accounts')

        await withAutomineOff('ethereum', async () => {
            await anvilRpc('ethereum', 'eth_sendTransaction', [
                { from, to: from, value: '0x1' },
            ])

            expect((await txpoolCounts('ethereum')).pending).toBe(1)
            await mine('ethereum')
            expect((await txpoolCounts('ethereum')).pending).toBe(0)
        })

        await setAutomine('ethereum', true)
        expect(await isAutomine('ethereum')).toBe(true)
    })

    describe('a misbehaving node', () => {
        let server: Server | undefined

        const listen = async (
            handler: Parameters<typeof createServer>[1],
        ): Promise<string> => {
            server = createServer(handler)
            await new Promise<void>(resolve =>
                server?.listen(0, '127.0.0.1', resolve),
            )
            return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
        }

        afterEach(async () => {
            server?.closeAllConnections()
            await new Promise(resolve => server?.close(resolve))
            server = undefined
        })

        it('times out a node that accepts the connection and never answers', async () => {
            const url = await listen(() => {})

            await expect(rpcAt(url, 'eth_chainId', [], 200)).rejects.toThrow(
                new RegExp(`eth_chainId to ${url} failed`),
            )
        })

        it('names the status when the node answers with an HTTP error', async () => {
            const url = await listen((_req, res) => {
                res.statusCode = 502
                res.end('bad gateway')
            })

            await expect(rpcAt(url, 'eth_chainId')).rejects.toThrow(/HTTP 502/)
        })

        it('names the method and url when the body is not JSON', async () => {
            const url = await listen((_req, res) => {
                res.end('<html>')
            })

            await expect(rpcAt(url, 'eth_chainId')).rejects.toThrow(
                new RegExp(
                    `eth_chainId to ${url} returned a body that is not JSON`,
                ),
            )
        })
    })
})
