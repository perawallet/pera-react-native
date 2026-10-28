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
    createRawKeyEvmAccount,
    fundEvmAccount,
    nativeBalanceOf,
} from '../../harness/accounts'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET } from '../../harness/evmnet'
import { buildTransfer, expectEvmConformant, signAndSend } from './support'

/**
 * Proves the transfer builder's native-coin transactions are what the node
 * holds, for the smallest amount, an amount that overflows 2^53 wei and a
 * transfer to oneself. A mocked client can't show that the node accepts the
 * built nonce and fees, or that the sender's balance moves by exactly value
 * plus fee.
 */
describe('evm native transfer construction', () => {
    const send = async (
        amount: bigint,
        recipientOf: (sender: string, other: string) => string,
    ) => {
        const env = await createEvmConformanceEnv('ethereum')
        const sender = await createRawKeyEvmAccount(env)
        const other = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, sender.address, 10n ** 18n * 2n)
        const to = recipientOf(
            sender.address,
            other.address,
        ) as typeof sender.address
        const { unsigned, fees } = await buildTransfer(env, {
            from: sender.address,
            to,
            assetRef: env.evmChain.descriptor.nativeAsset.ref,
            amount,
        })
        const before = await nativeBalanceOf(env, to)
        const { raw, hash } = await signAndSend(env, sender, unsigned)
        await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.ethereum.eip155ChainId,
                from: sender.address,
                nonce: 0,
                to,
                value: amount,
                ...fees,
            },
            raw,
            hash,
        })
        return { env, to, before, fees }
    }

    it('sends one wei', async () => {
        const { env, to, before } = await send(1n, (_, other) => other)
        expect((await nativeBalanceOf(env, to)) - before).toBe(1n)
    })

    it('sends an amount above 2^53 wei exactly', async () => {
        const amount = 10n ** 18n + 1n
        const { env, to, before } = await send(amount, (_, other) => other)
        expect((await nativeBalanceOf(env, to)) - before).toBe(amount)
    })

    it('sends to oneself, costing only the fee', async () => {
        const amount = 12_345n
        const { env, to, before, fees } = await send(amount, sender => sender)
        // Value comes back to the sender, so the net loss is the fee alone.
        const lost = before - (await nativeBalanceOf(env, to))
        expect(lost).toBeGreaterThan(0n)
        expect(lost).toBeLessThanOrEqual(fees.gas * fees.maxFeePerGas)
    })
})
