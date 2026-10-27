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

import type { Address, Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import {
    FEE_PRESETS,
    type FeePreset,
} from '@perawallet/wallet-core-chain-contract'
import { createEvmClient } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/createEvmClient'
import { readEvmFeePresets } from '@perawallet/wallet-core-chain-ethereum/transfer/fees'

import { createRawKeyEvmAccount, fundEvmAccount } from '../../harness/accounts'
import {
    ANVIL_DEV_PRIVATE_KEY,
    castAddressFromPrivateKey,
    castCalldata,
    castMktx,
    castSend,
} from '../../harness/cast'
import { deployContract } from '../../harness/contracts'
import {
    createEvmConformanceEnv,
    type EvmConformanceEnv,
} from '../../harness/context'
import { EVMNET, anvilRpc, mine, withAutomineOff } from '../../harness/evmnet'
import {
    buildTransfer,
    expectEvmConformant,
    signAndSend,
    storeNft,
} from '../construction/support'

const GWEI = 10n ** 9n

const RECIPIENT: Address = '0x000000000000000000000000000000000000dEaD'

// The app reads ten blocks at these percentiles; the oracle side restates
// them rather than importing the app's table.
const HISTORY_BLOCKS = 10
const PERCENTILES = [10, 50, 90] as const

type FeeHistory = {
    baseFeePerGas: Hex[]
    gasUsedRatio: number[]
    reward: Hex[][]
}

const randomKey = (): Hex =>
    `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`

const TXS_PER_BLOCK = 5

/**
 * Mines `HISTORY_BLOCKS` blocks of equal-gas transfers from one sender, tips
 * rising with the nonce so the block keeps that order, and every round's tips
 * differ so the upper median picks one round. Anvil weights each reward by
 * the block's cumulative gas at that transaction rather than its own gas: a
 * block of senders with one transaction each reports its lowest tip at every
 * percentile, which would hide a column mix-up. In nonce order its 10th, 50th
 * and 90th percentiles are still three different tips, as they are under the
 * per-transaction rule.
 */
const mineTippedHistory = async (env: EvmConformanceEnv): Promise<void> => {
    const key = randomKey()
    await fundEvmAccount(env, await castAddressFromPrivateKey(key), 10n ** 18n)
    await withAutomineOff(env.chain, async () => {
        for (let round = 0; round < HISTORY_BLOCKS; round++) {
            for (let rank = 0; rank < TXS_PER_BLOCK; rank++) {
                const tip = BigInt(round + 1) * GWEI + BigInt(rank) * 10n * GWEI
                const raw = await castMktx({
                    chain: env.chain,
                    privateKey: key,
                    nonce: round * TXS_PER_BLOCK + rank,
                    to: RECIPIENT,
                    value: 1n,
                    gas: 21_000n,
                    maxFeePerGas: tip + 100n * GWEI,
                    maxPriorityFeePerGas: tip,
                })
                await anvilRpc(env.chain, 'eth_sendRawTransaction', [raw])
            }
            await mine(env.chain)
        }
    })
}

const upperMedian = (values: bigint[]): bigint => {
    const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    return sorted[Math.floor(sorted.length / 2)]
}

/**
 * The node's own fee history reduced by the documented rule: rows of empty
 * blocks dropped, the upper median of each percentile column taken.
 */
const expectedTipsFromNode = async (
    env: EvmConformanceEnv,
    nonEmptyBlocks: number,
): Promise<{ baseFeePerGas: bigint; tips: bigint[] }> => {
    const history = await anvilRpc<FeeHistory>(env.chain, 'eth_feeHistory', [
        `0x${HISTORY_BLOCKS.toString(16)}`,
        'latest',
        [...PERCENTILES],
    ])
    const rows = history.reward.filter((_, i) => history.gasUsedRatio[i] > 0)
    expect(rows).toHaveLength(nonEmptyBlocks)
    return {
        baseFeePerGas: BigInt(history.baseFeePerGas.at(-1)!),
        tips: PERCENTILES.map((_, column) =>
            upperMedian(rows.map(row => BigInt(row[column]))),
        ),
    }
}

/**
 * Proves the EIP-1559 fee presets come from the node's real fee history, that
 * a transaction priced at each preset is mined in the next block paying its
 * full tip, and that the unpadded `estimateGas` limit covers what native,
 * ERC-20 and ERC-721 transfers use. A mocked fee history can't show the app
 * reads the node's percentile columns the way the node orders them.
 */
describe('evm fee presets', () => {
    it("derives each preset's tip from the node's fee history percentiles", async () => {
        const env = await createEvmConformanceEnv('ethereum')
        await mineTippedHistory(env)

        const client = createEvmClient(env.scope, env.ctx, env.evmChain)
        const app = await readEvmFeePresets(
            client,
            env.evmChain,
            env.scope.networkId,
        )
        const expected = await expectedTipsFromNode(env, HISTORY_BLOCKS)

        // Oracle parity: the node's history, reduced independently.
        expect(app.baseFeePerGas).toBe(expected.baseFeePerGas)
        expect(FEE_PRESETS).toEqual(['slow', 'normal', 'fast'])
        for (const [column, preset] of FEE_PRESETS.entries()) {
            const { maxPriorityFeePerGas, maxFeePerGas } = app.presets[preset]
            expect(maxPriorityFeePerGas).toBe(expected.tips[column])
            expect(maxFeePerGas).toBe(
                2n * expected.baseFeePerGas + maxPriorityFeePerGas,
            )
        }
        expect(app.presets.slow.maxPriorityFeePerGas).toBeLessThan(
            app.presets.normal.maxPriorityFeePerGas,
        )
        expect(app.presets.normal.maxPriorityFeePerGas).toBeLessThan(
            app.presets.fast.maxPriorityFeePerGas,
        )
    })

    it('leaves empty blocks out of the percentile median', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        await mineTippedHistory(env)
        // Half the window empty: counted as zero tips, they would pull every
        // preset down to the oldest tipped round.
        await mine(env.chain, HISTORY_BLOCKS / 2)

        const app = await readEvmFeePresets(
            createEvmClient(env.scope, env.ctx, env.evmChain),
            env.evmChain,
            env.scope.networkId,
        )
        const expected = await expectedTipsFromNode(env, HISTORY_BLOCKS / 2)

        // Oracle parity: the median of the tipped rows only.
        for (const [column, preset] of FEE_PRESETS.entries()) {
            expect(app.presets[preset].maxPriorityFeePerGas).toBe(
                expected.tips[column],
            )
        }
    })

    it('mines a transfer at each preset in the next block, paying the full tip', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        await mineTippedHistory(env)
        const sender = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, sender.address, 10n ** 18n)

        for (const [nonce, preset] of (
            ['slow', 'normal', 'fast'] as const satisfies readonly FeePreset[]
        ).entries()) {
            const head = BigInt(
                await anvilRpc<Hex>(env.chain, 'eth_blockNumber'),
            )
            const { unsigned, fees } = await buildTransfer(env, {
                from: sender.address,
                to: RECIPIENT,
                assetRef: env.evmChain.descriptor.nativeAsset.ref,
                amount: 1n,
                feePreset: preset,
            })
            const { raw, hash } = await signAndSend(env, sender, unsigned)
            const receipt = await expectEvmConformant({
                env,
                intent: {
                    chainId: EVMNET.ethereum.eip155ChainId,
                    from: sender.address,
                    nonce,
                    to: RECIPIENT,
                    value: 1n,
                    // App-chosen: gas and the preset's fee caps.
                    ...fees,
                },
                raw,
                hash,
            })

            // Node acceptance: the next block, with the cap leaving room for the whole tip.
            expect(receipt.blockNumber).toBe(head + 1n)
            const block = await anvilRpc<{ baseFeePerGas: Hex }>(
                env.chain,
                'eth_getBlockByNumber',
                [`0x${receipt.blockNumber.toString(16)}`, false],
            )
            expect(receipt.effectiveGasPrice).toBe(
                BigInt(block.baseFeePerGas) + fees.maxPriorityFeePerGas,
            )
        }
    })

    it('estimates a gas limit that covers native, ERC-20 and ERC-721 transfers', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const sender = await createRawKeyEvmAccount(env)
        const recipient = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, sender.address, 10n ** 18n)
        const token = await deployContract(
            env.chain,
            'TestToken',
            ['Conformance Token', 'CFT', (10n ** 30n).toString()],
            'constructor(string,string,uint256)',
        )
        await castSend({
            chain: env.chain,
            privateKey: ANVIL_DEV_PRIVATE_KEY,
            to: token,
            sig: 'transfer(address,uint256)',
            args: [sender.address, (10n ** 20n).toString()],
        })
        const nft = await deployContract(env.chain, 'TestNft721')
        const tokenId = 7n
        await castSend({
            chain: env.chain,
            privateKey: ANVIL_DEV_PRIVATE_KEY,
            to: nft,
            sig: 'mint(address,uint256)',
            args: [sender.address, tokenId.toString()],
        })
        const nftAssetId = await storeNft(env, nft, tokenId, 'erc721')

        const transfers = [
            {
                assetRef: env.evmChain.descriptor.nativeAsset.ref,
                amount: 1n,
                to: recipient.address,
                value: 1n,
                data: undefined,
            },
            {
                assetRef: { chainId: env.chain, assetId: token },
                amount: 10n ** 18n,
                to: token,
                value: 0n,
                data: await castCalldata('transfer(address,uint256)', [
                    recipient.address,
                    (10n ** 18n).toString(),
                ]),
            },
            {
                assetRef: { chainId: env.chain, assetId: nftAssetId },
                amount: 1n,
                to: nft,
                value: 0n,
                data: await castCalldata(
                    'safeTransferFrom(address,address,uint256)',
                    [sender.address, recipient.address, tokenId.toString()],
                ),
            },
        ]
        for (const [nonce, transfer] of transfers.entries()) {
            const { unsigned, fees } = await buildTransfer(env, {
                from: sender.address,
                to: recipient.address,
                assetRef: transfer.assetRef,
                amount: transfer.amount,
            })
            const { raw, hash } = await signAndSend(env, sender, unsigned)
            const receipt = await expectEvmConformant({
                env,
                intent: {
                    chainId: EVMNET.ethereum.eip155ChainId,
                    from: sender.address,
                    nonce,
                    to: transfer.to,
                    value: transfer.value,
                    data: transfer.data,
                    // App-chosen: the estimated limit under test and the fee caps.
                    ...fees,
                },
                raw,
                hash,
            })
            // Node acceptance: the unpadded estimate is enough.
            expect(receipt.gasUsed).toBeLessThanOrEqual(fees.gas)
        }
    })
})
