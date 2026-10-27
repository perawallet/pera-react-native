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
import {
    EVMNET,
    EVMNET_CHAINS,
    anvilRpc,
    assertEvmnetReachable,
    assertRpcReachable,
    isAutomine,
    mine,
    setAutomine,
    txpoolCounts,
    withAutomineOff,
} from '../evmnet'

describe('evmnet', () => {
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
        const { ethereum } = EVMNET

        await expect(
            assertRpcReachable('http://127.0.0.1:1', 'ethereum', ethereum),
        ).rejects.toThrow(/evmnet is not reachable at http:\/\/127\.0\.0\.1:1/)
        await expect(
            assertRpcReachable('http://127.0.0.1:1', 'ethereum', ethereum),
        ).rejects.toThrow(/pnpm evmnet/)
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
})
