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

import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import { BaseError, hexToBytes, type Address, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import {
    EvmError,
    EvmErrorCode,
    toEvmError,
} from '@perawallet/wallet-core-chain-ethereum/blockchain/errors'
import { createEvmClient } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/createEvmClient'
import { buildEthereumSendTransaction } from '@perawallet/wallet-core-chain-ethereum/connect/sendTransaction'
import type { EthereumTransactionPayload } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import { createEvmBroadcasterAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/broadcaster'

import { createRawKeyEvmAccount, fundEvmAccount } from '../../harness/accounts'
import { castCalldata } from '../../harness/cast'
import { deployContract } from '../../harness/contracts'
import {
    createEvmConformanceEnv,
    createEvmnetChainContext,
    type EvmConformanceEnv,
} from '../../harness/context'
import { signTransactionWithApp } from '../../harness/sign'
import { rejectionOf } from '../../harness/submit'
import {
    appClient,
    feesOf,
    minedReceipt,
    signedReplacement,
    signedTransfer,
    submitAndRecord,
    withPendingPool,
} from '../submission/support'

const RECIPIENT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const SYMBOL = 'ETH'

const setUp = async () => {
    const env = await createEvmConformanceEnv('ethereum')
    const sender = await createRawKeyEvmAccount(env)
    await fundEvmAccount(env, sender.address, 10n ** 18n)
    return { env, sender }
}

/** What viem hands the app for a node refusal: the node's own text is in `details`. */
const nodeTextOf = (error: unknown): string => {
    expect(error).toBeInstanceOf(BaseError)
    return (error as BaseError).details
}

const sendRaw = (env: EvmConformanceEnv, raw: Hex) =>
    appClient(env).sendRawTransaction({ serializedTransaction: raw })

/** The app's own build of a call to the Reverter, as for a dApp's request. */
const revertingCallInput = async (
    env: EvmConformanceEnv,
    from: Address,
    signature: string,
) => ({
    from,
    to: await deployContract(env.chain, 'Reverter'),
    value: 0n,
    data: await castCalldata(signature),
})

/**
 * Pins the text a real Anvil gives for each rejection class and the code
 * `toEvmError` assigns it. Classification is a regex over node text, and only
 * a real node's text can show drift: a regex tested against strings the test
 * author wrote passes whatever the node says. The node text is asserted
 * first so a drifted string fails there, not as a wrong code.
 */
describe('evm node rejections classified by toEvmError', () => {
    it('classifies a spend beyond the balance as INSUFFICIENT_FUNDS', async () => {
        const { env, sender } = await setUp()
        // The app's own spendable check would refuse this, so the value is
        // raised after the build and re-signed: the node must be the one refusing.
        const unsigned = await buildEthereumSendTransaction(
            env.ctx,
            env.evmChain,
            { from: sender.address, to: RECIPIENT, value: 1n, data: '0x' },
        )
        const payload = unsigned.payload as EthereumTransactionPayload
        const raised = {
            ...unsigned,
            payload: {
                ...payload,
                transaction: { ...payload.transaction, value: 10n ** 19n },
            },
        }
        const raw = await signTransactionWithApp(env, sender, raised)

        const error = await rejectionOf(() => sendRaw(env, raw))

        expect(nodeTextOf(error)).toBe(
            'Insufficient funds for gas * price + value',
        )
        expect(toEvmError(error, SYMBOL).code).toBe(
            EvmErrorCode.INSUFFICIENT_FUNDS,
        )
    })

    it('classifies a resend at a mined nonce as NONCE_TOO_LOW', async () => {
        const { env, sender } = await setUp()
        const { raw } = await signedTransfer(env, sender, RECIPIENT, 1n)
        await minedReceipt(env.chain, await submitAndRecord(env, raw))

        const error = await rejectionOf(() => sendRaw(env, raw))

        expect(nodeTextOf(error)).toBe('nonce too low')
        expect(toEvmError(error, SYMBOL).code).toBe(EvmErrorCode.NONCE_TOO_LOW)
    })

    it('classifies a replacement that leaves the max fee unchanged as REPLACEMENT_UNDERPRICED', async () => {
        const { env, sender } = await setUp()
        const gwei = 10n ** 9n
        const original = await signedTransfer(env, sender, RECIPIENT, 1n, {
            maxFeePerGas: 100n * gwei,
            maxPriorityFeePerGas: 2n * gwei,
        })
        await withPendingPool(env.chain, async () => {
            await submitAndRecord(env, original.raw)
            const replacement = await signedReplacement(
                env,
                sender,
                'speed-up',
                original.raw,
                {
                    maxFeePerGas: 100n * gwei,
                    maxPriorityFeePerGas: 3n * gwei,
                },
            )
            expect(feesOf(replacement.raw).maxFeePerGas).toBe(100n * gwei)

            // Anvil's pool takes a 5% bump of both fees, so the refusal needs
            // one fee left unchanged. Sent raw: the app's own submit refuses an underpriced bump
            // before the node sees it, which would hide the node's text.
            const error = await rejectionOf(() => sendRaw(env, replacement.raw))

            expect(nodeTextOf(error)).toBe(
                'replacement transaction underpriced',
            )
            expect(toEvmError(error, SYMBOL).code).toBe(
                EvmErrorCode.REPLACEMENT_UNDERPRICED,
            )
        })
    })

    it('classifies a gas limit below the intrinsic cost as OUT_OF_GAS', async () => {
        const { env, sender } = await setUp()
        const unsigned = await buildEthereumSendTransaction(
            env.ctx,
            env.evmChain,
            {
                from: sender.address,
                to: RECIPIENT,
                value: 1n,
                data: '0x',
                gas: 20_000n,
            },
        )
        const raw = await signTransactionWithApp(env, sender, unsigned)

        const error = await rejectionOf(() => sendRaw(env, raw))

        expect(nodeTextOf(error)).toBe('intrinsic gas too low')
        expect(toEvmError(error, SYMBOL).code).toBe(EvmErrorCode.OUT_OF_GAS)
    })

    it('classifies a require() revert as REVERTED_WITH_REASON carrying the reason', async () => {
        const { env, sender } = await setUp()
        const input = await revertingCallInput(
            env,
            sender.address,
            'revertWithReason()',
        )

        const error = await rejectionOf(() =>
            appClient(env).estimateGas({ account: input.from, ...input }),
        )

        expect(nodeTextOf(error)).toBe(
            'execution reverted: conformance: reason',
        )
        const classified = toEvmError(error, SYMBOL)
        expect(classified.code).toBe(EvmErrorCode.REVERTED_WITH_REASON)
        expect(classified.params).toEqual({
            reason: 'conformance: reason',
            symbol: SYMBOL,
        })

        // The app's own build path throws the same classification.
        const built = await rejectionOf(() =>
            buildEthereumSendTransaction(env.ctx, env.evmChain, input),
        )
        expect(built).toBeInstanceOf(EvmError)
        expect((built as EvmError).code).toBe(EvmErrorCode.REVERTED_WITH_REASON)
    })

    it('classifies a custom error as REVERTED, with no raw selector and data as a reason', async () => {
        const { env, sender } = await setUp()
        const input = await revertingCallInput(
            env,
            sender.address,
            'revertWithCustomError()',
        )

        const error = await rejectionOf(() =>
            appClient(env).estimateGas({ account: input.from, ...input }),
        )

        // Anvil cannot decode the error without the ABI, so it prints the
        // selector (ConformanceError(uint256)) and the data bytes as text.
        expect(nodeTextOf(error)).toMatch(
            /^execution reverted: custom error 0x2712e753: .*\*$/s,
        )
        const classified = toEvmError(error, SYMBOL)
        expect(classified.code).toBe(EvmErrorCode.REVERTED)
        expect(classified.params).toEqual({ symbol: SYMBOL })
    })

    it("classifies a Solidity panic as REVERTED_WITH_REASON carrying the node's panic text", async () => {
        const { env, sender } = await setUp()
        const input = await revertingCallInput(env, sender.address, 'panic()')

        const error = await rejectionOf(() =>
            appClient(env).estimateGas({ account: input.from, ...input }),
        )

        expect(nodeTextOf(error)).toBe(
            'execution reverted: panic: division or modulo by zero (0x12)',
        )
        const classified = toEvmError(error, SYMBOL)
        expect(classified.code).toBe(EvmErrorCode.REVERTED_WITH_REASON)
        expect(classified.params).toEqual({
            reason: 'panic: division or modulo by zero (0x12)',
            symbol: SYMBOL,
        })
    })

    it('fails the confirmation wait with REVERTED when execution runs out of gas', async () => {
        const { env, sender } = await setUp()
        const input = await revertingCallInput(env, sender.address, 'burnGas()')
        const gasLimit = 100_000n
        const unsigned = await buildEthereumSendTransaction(
            env.ctx,
            env.evmChain,
            { ...input, gas: gasLimit },
        )
        const raw = await signTransactionWithApp(env, sender, unsigned)
        const broadcaster = createEvmBroadcasterAdapter(env.ctx, env.evmChain)
        const [hash] = await broadcaster.submit(env.scope, [hexToBytes(raw)])

        // Node acceptance: the node mined the call, failed, and charged the whole limit.
        const receipt = await minedReceipt(env.chain, hash as Hex)
        expect(receipt.status).toBe('0x0')
        expect(BigInt(receipt.gasUsed)).toBe(gasLimit)

        const failure = await rejectionOf(() =>
            broadcaster.waitForConfirmation(env.scope, [hash]),
        )
        expect(failure).toBeInstanceOf(EvmError)
        expect((failure as EvmError).code).toBe(EvmErrorCode.REVERTED)
    })

    it('classifies an HTTP 429 as RATE_LIMITED', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        // Synthetic: Anvil never rate-limits, and a real provider's 429 body
        // varies, so only the status that viem maps is reproduced.
        const server = createServer((_req, res) => {
            res.writeHead(429, { 'content-type': 'text/plain' })
            res.end('Too Many Requests')
        })
        await new Promise<void>(resolve =>
            server.listen(0, '127.0.0.1', resolve),
        )
        try {
            const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
            const ctx = {
                ...createEvmnetChainContext(env.chain, env.kms),
                getEndpoints: () => ({ [env.scope.networkId]: url }),
            }
            const client = createEvmClient(env.scope, ctx, env.evmChain)

            const error = await rejectionOf(() => client.getBlockNumber())

            expect(nodeTextOf(error)).toContain('Too Many Requests')
            expect(toEvmError(error, SYMBOL).code).toBe(
                EvmErrorCode.RATE_LIMITED,
            )
        } finally {
            server.closeAllConnections()
            await new Promise(resolve => server.close(resolve))
        }
    })
})
