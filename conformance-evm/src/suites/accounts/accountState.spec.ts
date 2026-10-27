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

import type { Decimal } from 'decimal.js'
import { hexToBytes, type Address, type Hex } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import * as endpoints from '@perawallet/wallet-core-chain-ethereum/assets/api/endpoints'
import { createEthereumAccountStateOps } from '@perawallet/wallet-core-chain-ethereum/accounts/account-state'
import { createEvmBroadcasterAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/broadcaster'

import { createRawKeyEvmAccount, fundEvmAccount } from '../../harness/accounts'
import { ANVIL_DEV_PRIVATE_KEY, castSend } from '../../harness/cast'
import { deployContract } from '../../harness/contracts'
import {
    createEvmConformanceEnv,
    type EvmConformanceEnv,
} from '../../harness/context'
import { anvilRpc, mine, withAutomineOff } from '../../harness/evmnet'
import { signTransactionWithApp } from '../../harness/sign'
import { buildTransfer, signAndSend } from '../construction/support'

// The whitelist is a Pera service answer, not a node call: it is how the app
// learns which tokens to read, so the test supplies it.
const whitelist = { tokens: [] as string[] }
beforeEach(() => {
    vi.spyOn(endpoints, 'fetchWhitelist').mockImplementation(async () =>
        whitelist.tokens.map(assetId => ({ assetId, type: 'erc20' as const })),
    )
})

// A first sync: the account has no stored chain state yet.
const NO_PRIOR = { priorChainState: undefined }

const withAssetsService = (env: EvmConformanceEnv): ChainContext => ({
    ...env.ctx,
    getPeraBackend: () => ({
        baseUrl: '',
        services: new Set(['assets']),
    }),
})

const blockNumber = async (env: EvmConformanceEnv): Promise<bigint> =>
    BigInt(await anvilRpc<Hex>(env.chain, 'eth_blockNumber'))

const mintToken = async (
    env: EvmConformanceEnv,
    name: 'TestToken' | 'SixDecimalToken',
    holder: Address,
    amount: bigint,
): Promise<Address> => {
    const token = await deployContract(
        env.chain,
        name,
        ['Conformance Token', 'CFT', (10n ** 30n).toString()],
        'constructor(string,string,uint256)',
    )
    await castSend({
        chain: env.chain,
        privateKey: ANVIL_DEV_PRIVATE_KEY,
        to: token,
        sig: 'transfer(address,uint256)',
        args: [holder, amount.toString()],
    })
    return token
}

/**
 * Proves the account-state read reports the balances, nonces and block the node
 * holds: native and ERC-20 balances exact above 2^53 and pinned to one block,
 * latest and pending nonces apart while a transaction is pooled, and the
 * existence check across fresh, funded and emptied-but-used addresses. A
 * mocked client can't show Multicall3 decoding or the pending nonce.
 */
describe('evm account state', () => {
    afterEach(() => {
        whitelist.tokens = []
        vi.restoreAllMocks()
    })

    it('reads the native balance and nonces with the assets service off, and no tokens', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const holder = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, holder.address, 2n ** 62n)
        await mintToken(env, 'TestToken', holder.address, 5n)

        const state = await createEthereumAccountStateOps(
            env.ctx,
            env.evmChain,
        ).fetchAccountState(holder.address, env.scope, NO_PRIOR)

        expect(state.nativeBalanceBaseUnits.toFixed()).toBe(
            (2n ** 62n).toString(),
        )
        expect(state.chainState).toEqual({
            family: 'evm',
            nonce: { latest: 0, pending: 0 },
        })
        // No whitelist means no tokens to ask Multicall3 about.
        expect(state.holdings).toHaveLength(1)
        expect(state.observedRound).toBe(Number(await blockNumber(env)))
    })

    it('reads native and listed ERC-20 balances above 2^53 at one block', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const holder = await createRawKeyEvmAccount(env)
        const other = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, holder.address, 2n ** 62n + 1n)
        const bigAmount = 2n ** 64n + 3n
        const token = await mintToken(
            env,
            'TestToken',
            holder.address,
            bigAmount,
        )
        const sixAmount = 9_007_199_254_740_993n
        const six = await mintToken(
            env,
            'SixDecimalToken',
            holder.address,
            sixAmount,
        )
        // A listed token the holder has none of is left out of the holdings.
        const empty = await mintToken(env, 'TestToken', other.address, 0n)
        whitelist.tokens = [token, six, empty]

        const state = await createEthereumAccountStateOps(
            withAssetsService(env),
            env.evmChain,
        ).fetchAccountState(holder.address, env.scope, NO_PRIOR)

        const amountOf = (assetId: string): Decimal | undefined =>
            state.holdings.find(
                h => h.assetId.toLowerCase() === assetId.toLowerCase(),
            )?.amount
        expect(state.nativeBalanceBaseUnits.toFixed()).toBe(
            (2n ** 62n + 1n).toString(),
        )
        expect(amountOf(token)?.toFixed()).toBe(bigAmount.toString())
        expect(amountOf(six)?.toFixed()).toBe(sixAmount.toString())
        expect(amountOf(empty)).toBeUndefined()
        expect(state.observedRound).toBe(Number(await blockNumber(env)))
    })

    it('reports the pooled transaction in the pending nonce only', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const sender = await createRawKeyEvmAccount(env)
        const recipient = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, sender.address, 10n ** 18n)
        const nativeRef = env.evmChain.descriptor.nativeAsset.ref
        const first = await buildTransfer(env, {
            from: sender.address,
            to: recipient.address,
            assetRef: nativeRef,
            amount: 1n,
        })
        await signAndSend(env, sender, first.unsigned)
        const ops = createEthereumAccountStateOps(env.ctx, env.evmChain)

        await withAutomineOff(env.chain, async () => {
            const second = await buildTransfer(env, {
                from: sender.address,
                to: recipient.address,
                assetRef: nativeRef,
                amount: 2n,
            })
            const raw = await signTransactionWithApp(
                env,
                sender,
                second.unsigned,
            )
            await createEvmBroadcasterAdapter(env.ctx, env.evmChain).submit(
                env.scope,
                [hexToBytes(raw)],
            )

            const pooled = await ops.fetchAccountState(
                sender.address,
                env.scope,
                NO_PRIOR,
            )
            expect(pooled.chainState).toEqual({
                family: 'evm',
                nonce: { latest: 1, pending: 2 },
            })

            await mine(env.chain)
        })

        const mined = await ops.fetchAccountState(
            sender.address,
            env.scope,
            NO_PRIOR,
        )
        expect(mined.chainState).toEqual({
            family: 'evm',
            nonce: { latest: 2, pending: 2 },
        })
    })

    it('tells a fresh, a funded and an emptied-but-used address apart', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const account = await createRawKeyEvmAccount(env)
        const other = await createRawKeyEvmAccount(env)
        const ops = createEthereumAccountStateOps(env.ctx, env.evmChain)

        expect(await ops.accountExists(account.address, env.scope)).toBe(false)

        await fundEvmAccount(env, account.address, 10n ** 18n)
        expect(await ops.accountExists(account.address, env.scope)).toBe(true)

        const { unsigned } = await buildTransfer(env, {
            from: account.address,
            to: other.address,
            assetRef: env.evmChain.descriptor.nativeAsset.ref,
            amount: 1n,
        })
        await signAndSend(env, account, unsigned)
        await anvilRpc(env.chain, 'anvil_setBalance', [account.address, '0x0'])
        // Nothing left to spend, but the nonce says the key has been used.
        expect(await ops.accountExists(account.address, env.scope)).toBe(true)
    })
})
