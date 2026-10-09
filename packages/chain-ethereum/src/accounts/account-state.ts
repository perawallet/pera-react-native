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

import { Decimal } from 'decimal.js'
import type { Address } from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type {
    AccountChangeSignal,
    AccountsChainAdapter,
    AccountStateSnapshot,
} from '@perawallet/wallet-core-accounts'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { ethereumDescriptor } from '../descriptor'
import { BLOCK_FOLLOWING_SERVICE, fetchShouldRefresh } from './endpoints'
import { createEvmClient } from '../blockchain/utils/createEvmClient'

export type EthereumAccountStateOps = Required<
    Pick<
        AccountsChainAdapter,
        | 'fetchAccountState'
        | 'accountExists'
        | 'checkActivity'
        | 'fetchChangeSignal'
    >
> & { readonly chainId: typeof ETHEREUM_CHAIN_ID }

const NATIVE_ASSET_ID = ethereumDescriptor.nativeAsset.ref.assetId

const readFootprint = async (
    ctx: ChainContext,
    address: string,
    scope: ChainScope,
) => {
    const client = createEvmClient(scope, ctx)
    const [balance, nonce] = await Promise.all([
        client.getBalance({ address: address as Address }),
        client.getTransactionCount({ address: address as Address }),
    ])
    return balance > 0n || nonce > 0
}

const fetchAccountState =
    (ctx: ChainContext): EthereumAccountStateOps['fetchAccountState'] =>
    async (address, scope): Promise<AccountStateSnapshot> => {
        const client = createEvmClient(scope, ctx)
        const target = address as Address
        // Pinning the latest reads to one block keeps balance, nonce and
        // observedRound from straddling a block boundary.
        const blockNumber = await client.getBlockNumber()
        const [wei, latest, pending] = await Promise.all([
            client.getBalance({ address: target, blockNumber }),
            client.getTransactionCount({ address: target, blockNumber }),
            client.getTransactionCount({
                address: target,
                blockTag: 'pending',
            }),
        ])
        const baseUnits = new Decimal(wei.toString())
        return {
            nativeBalanceBaseUnits: baseUnits,
            chainState: { family: 'evm', nonce: { latest, pending } },
            // Token holdings come from the assets adapter; native only here.
            holdings: [
                {
                    assetId: NATIVE_ASSET_ID,
                    amount: baseUnits,
                    isFrozen: false,
                },
            ],
            observedRound: Number(blockNumber),
        }
    }

const fetchChangeSignal =
    (ctx: ChainContext): EthereumAccountStateOps['fetchChangeSignal'] =>
    async (addresses, scope, cursor): Promise<AccountChangeSignal> => {
        if (ctx.getPeraBackend(scope).services.has(BLOCK_FOLLOWING_SERVICE)) {
            const { refresh, block } = await fetchShouldRefresh(
                scope,
                addresses,
                cursor,
            )
            return { changed: cursor === null || refresh, cursor: block }
        }
        // Without block following any new block counts as a change, since
        // plain JSON-RPC can't say which addresses a block touched.
        const head = Number(await createEvmClient(scope, ctx).getBlockNumber())
        if (cursor === null) return { changed: true, cursor: head }
        // A lagging node can report a head behind the cursor; never move it back.
        return { changed: head > cursor, cursor: Math.max(head, cursor) }
    }

export const createEthereumAccountStateOps = (
    ctx: ChainContext,
): EthereumAccountStateOps => ({
    chainId: ETHEREUM_CHAIN_ID,
    fetchAccountState: fetchAccountState(ctx),
    accountExists: (address, scope) => readFootprint(ctx, address, scope),
    checkActivity: async (addresses, scope) =>
        new Map(
            await Promise.all(
                addresses.map(
                    async address =>
                        [
                            address,
                            await readFootprint(ctx, address, scope).catch(
                                () => false,
                            ),
                        ] as const,
                ),
            ),
        ),
    fetchChangeSignal: fetchChangeSignal(ctx),
})
