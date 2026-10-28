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

import { hexToBytes, type Hex, type TransactionReceipt } from 'viem'
import { createEvmClient } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/createEvmClient'
import { createEvmBroadcasterAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/broadcaster'

import type { EvmConformanceEnv } from './context'

/**
 * Broadcasts through the app's broadcaster and waits with its own
 * confirmation check, which throws on a reverted receipt. The receipt is
 * read back through the app's client.
 */
export const broadcastAndConfirm = async (
    env: EvmConformanceEnv,
    raw: Hex,
): Promise<{ hash: Hex; receipt: TransactionReceipt }> => {
    const broadcaster = createEvmBroadcasterAdapter(env.ctx, env.evmChain)
    const [hash] = (await broadcaster.submit(env.scope, [
        hexToBytes(raw),
    ])) as Hex[]
    await broadcaster.waitForConfirmation(env.scope, [hash])
    const receipt = await createEvmClient(
        env.scope,
        env.ctx,
        env.evmChain,
    ).getTransactionReceipt({ hash })
    return { hash, receipt }
}

/** The error `fn` rejected with; a resolution is itself the failure. */
export const rejectionOf = async (
    fn: () => Promise<unknown>,
): Promise<unknown> => {
    let value: unknown
    try {
        value = await fn()
    } catch (error) {
        return error
    }
    throw new Error(
        `expected a rejection, but the call resolved with ${String(value)}`,
    )
}
