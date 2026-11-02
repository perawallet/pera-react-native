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
    buildEthereumSendTransaction,
    validateEthereumSendTransaction,
} from '@perawallet/wallet-core-chain-ethereum/connect/sendTransaction'
import type { EthereumTransactionPayload } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'

import { createRawKeyEvmAccount, fundEvmAccount } from '../../harness/accounts'
import { expectEvmConformant } from '../../harness/assert/roundTrip'
import { castAllowanceOf, castCalldata, castEstimate } from '../../harness/cast'
import { deployContract } from '../../harness/contracts'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET } from '../../harness/evmnet'
import { signTransactionWithApp } from '../../harness/sign'
import { broadcastAndConfirm } from '../../harness/submit'
import { feesOf, minedReceipt } from '../submission/support'

const SPENDER: Address = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
// Above 2^53, so a `number` anywhere on the path would round it.
const ALLOWANCE = 9_007_199_254_740_993n * 1_000_003n

const setUp = async () => {
    const env = await createEvmConformanceEnv('ethereum')
    const owner = await createRawKeyEvmAccount(env)
    await fundEvmAccount(env, owner.address, 10n ** 18n)
    const token = await deployContract(
        env.chain,
        'TestToken',
        ['Conformance Token', 'CFT', (10n ** 30n).toString()],
        'constructor(string,string,uint256)',
    )
    const approveData = await castCalldata('approve(address,uint256)', [
        SPENDER,
        ALLOWANCE.toString(),
    ])
    return { env, owner, token, approveData }
}

// The dApp's own JSON-RPC object, through the same validation WalletConnect runs.
const dappRequest = (
    owner: Address,
    token: Address,
    data: Hex,
    gas?: bigint,
) => {
    const validated = validateEthereumSendTransaction(
        {
            from: owner,
            to: token,
            data,
            ...(gas !== undefined && { gas: `0x${gas.toString(16)}` }),
        },
        {
            authorizedAccounts: [owner],
            eip155ChainId: EVMNET.ethereum.eip155ChainId,
        },
    )
    if (!validated.ok) throw new Error(validated.message)
    return validated.request
}

const sanityChecked = (raw: Hex) => {
    const fees = feesOf(raw)
    expect(fees.maxFeePerGas).toBeGreaterThanOrEqual(fees.maxPriorityFeePerGas)
    expect(fees.maxFeePerGas).toBeGreaterThan(0n)
    return fees
}

/**
 * Proves the gas a dApp's `eth_sendTransaction` is signed with: the larger of
 * the dApp's figure and the node's estimate padded by a fifth. A mock
 * estimator would agree with any number; only a node's estimate and a mined
 * receipt say whether the call fits.
 */
describe('evm dapp eth_sendTransaction against a node', () => {
    it("keeps a dApp's gas above the padded estimate and lands its approve, setting the allowance", async () => {
        const { env, owner, token, approveData } = await setUp()
        const gas = 77_777n

        const unsigned = await buildEthereumSendTransaction(
            env.ctx,
            env.evmChain,
            dappRequest(owner.address, token, approveData, gas),
        )
        const raw = await signTransactionWithApp(env, owner, unsigned)
        const { hash } = await broadcastAndConfirm(env, raw)

        // Round-trip: the dApp's gas, not an estimate, is what the node holds.
        await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.ethereum.eip155ChainId,
                from: owner.address,
                nonce: 0,
                to: token,
                data: approveData,
                gas,
                // The wallet's own pricing, sanity-bounded.
                ...sanityChecked(raw),
            },
            raw,
            hash,
        })
        expect(
            await castAllowanceOf(env.chain, token, owner.address, SPENDER),
        ).toBe(ALLOWANCE)
    })

    it("signs the node's estimate padded by a fifth when the dApp gives no gas", async () => {
        const { env, owner, token, approveData } = await setUp()
        // Oracle parity: cast asks the node at the same state the app builds on.
        const estimate = await castEstimate({
            chain: env.chain,
            from: owner.address,
            to: token,
            data: approveData,
        })

        const unsigned = await buildEthereumSendTransaction(
            env.ctx,
            env.evmChain,
            dappRequest(owner.address, token, approveData),
        )
        const { transaction } = unsigned.payload as EthereumTransactionPayload
        const padded = (estimate * 6n) / 5n
        expect(transaction.gas).toBe(padded)

        const raw = await signTransactionWithApp(env, owner, unsigned)
        const { hash } = await broadcastAndConfirm(env, raw)
        await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.ethereum.eip155ChainId,
                from: owner.address,
                nonce: 0,
                to: token,
                data: approveData,
                gas: padded,
                // The wallet's own pricing, sanity-bounded.
                ...sanityChecked(raw),
            },
            raw,
            hash,
        })
        expect(
            await castAllowanceOf(env.chain, token, owner.address, SPENDER),
        ).toBe(ALLOWANCE)
    })

    it("raises a dApp's too-low gas to the padded estimate, so the approve lands and sets the allowance", async () => {
        const { env, owner, token, approveData } = await setUp()
        // Above the intrinsic cost, so a node would accept it; below the first
        // allowance write's storage cost, so signed as given it runs out.
        const gas = 30_000n
        const estimate = await castEstimate({
            chain: env.chain,
            from: owner.address,
            to: token,
            data: approveData,
        })

        const unsigned = await buildEthereumSendTransaction(
            env.ctx,
            env.evmChain,
            dappRequest(owner.address, token, approveData, gas),
        )
        const { transaction } = unsigned.payload as EthereumTransactionPayload
        expect(transaction.gas).toBe((estimate * 6n) / 5n)

        const raw = await signTransactionWithApp(env, owner, unsigned)
        const { hash } = await broadcastAndConfirm(env, raw)

        // Node acceptance: mined and succeeded, within the limit the app raised it to.
        const receipt = await minedReceipt(env.chain, hash)
        expect(receipt.status).toBe('0x1')
        expect(BigInt(receipt.gasUsed)).toBeLessThanOrEqual(transaction.gas!)
        expect(
            await castAllowanceOf(env.chain, token, owner.address, SPENDER),
        ).toBe(ALLOWANCE)
    })
})
