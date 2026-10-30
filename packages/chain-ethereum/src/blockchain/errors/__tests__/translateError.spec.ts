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
    BaseError,
    ContractFunctionRevertedError,
    ExecutionRevertedError,
    HttpRequestError,
    InsufficientFundsError,
    InvalidInputRpcError,
    IntrinsicGasTooLowError,
    LimitExceededRpcError,
    NonceTooLowError,
    RpcRequestError,
    UnknownNodeError,
    type Abi,
} from 'viem'
import {
    BlockchainError,
    ErrorCategory,
    ErrorSeverity,
    isExpectedError,
} from '@perawallet/wallet-core-shared'
import { EvmError, toEvmError } from '..'

const URL = 'https://rpc.example'

// viem surfaces node failures wrapped in a call/estimate error, so every
// case is classified from inside a cause chain, not at the top.
const wrapped = (cause: Error): BaseError =>
    new BaseError('Execution failed.', { cause })

const rpcError = (message: string, code = -32000): RpcRequestError =>
    new RpcRequestError({ body: {}, error: { code, message }, url: URL })

const ERROR_STRING_ABI: Abi = [
    {
        type: 'error',
        name: 'Error',
        inputs: [{ name: 'message', type: 'string' }],
    },
]

// abi.encodeWithSignature("Error(string)", "Ownable: caller is not the owner")
const OWNABLE_REVERT_DATA =
    '0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000204f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572'

describe('toEvmError', () => {
    it.each([
        {
            name: 'a decoded Error(string) revert',
            error: wrapped(
                new ContractFunctionRevertedError({
                    abi: ERROR_STRING_ABI,
                    data: OWNABLE_REVERT_DATA,
                    functionName: 'transfer',
                }),
            ),
            code: 'reverted_with_reason',
            params: { reason: 'Ownable: caller is not the owner' },
        },
        {
            name: "a node's execution-reverted message with a reason",
            error: wrapped(
                new ExecutionRevertedError({
                    message:
                        'execution reverted: ERC20: transfer amount exceeds balance',
                }),
            ),
            code: 'reverted_with_reason',
            params: { reason: 'ERC20: transfer amount exceeds balance' },
        },
        {
            name: 'a revert whose reason mentions insufficient funds',
            error: wrapped(
                new ExecutionRevertedError({
                    message: 'execution reverted: Vault: insufficient funds',
                }),
            ),
            code: 'reverted_with_reason',
            params: { reason: 'Vault: insufficient funds' },
        },
        {
            name: 'a revert whose reason mentions nonce too low',
            error: wrapped(
                new ExecutionRevertedError({
                    message: 'execution reverted: Relayer: nonce too low',
                }),
            ),
            code: 'reverted_with_reason',
            params: { reason: 'Relayer: nonce too low' },
        },
        {
            name: 'a revert with no reason',
            error: wrapped(
                new ExecutionRevertedError({ message: 'execution reverted' }),
            ),
            code: 'reverted',
            params: {},
        },
        {
            name: "geth's estimateGas gas-allowance failure",
            error: wrapped(
                new ExecutionRevertedError({
                    message: 'gas required exceeds allowance (21000)',
                }),
            ),
            code: 'out_of_gas',
            params: {},
        },
        {
            name: 'an intrinsic gas too low rejection',
            error: wrapped(new IntrinsicGasTooLowError()),
            code: 'out_of_gas',
            params: {},
        },
        {
            name: "a node's unclassified intrinsic gas too low rejection",
            error: new InvalidInputRpcError(rpcError('intrinsic gas too low')),
            code: 'out_of_gas',
            params: {},
        },
        {
            name: "Anvil's undecoded custom error",
            error: wrapped(
                new ExecutionRevertedError({
                    message: `execution reverted: custom error 0x2712e753: ${'\u0000'.repeat(31)}*`,
                }),
            ),
            code: 'reverted',
            params: {},
        },
        {
            name: 'a nonce too low rejection',
            error: wrapped(new NonceTooLowError({ nonce: 7 })),
            code: 'nonce_too_low',
            params: {},
        },
        {
            name: "geth's replacement transaction underpriced",
            error: wrapped(
                new UnknownNodeError({
                    cause: rpcError('replacement transaction underpriced'),
                }),
            ),
            code: 'replacement_underpriced',
            params: {},
        },
        {
            name: "erigon's replacement fee too low",
            error: wrapped(
                new UnknownNodeError({
                    cause: rpcError('replacement fee too low'),
                }),
            ),
            code: 'replacement_underpriced',
            params: {},
        },
        {
            name: 'an insufficient funds rejection',
            error: wrapped(new InsufficientFundsError()),
            code: 'insufficient_funds',
            params: {},
        },
        {
            name: "a node's unclassified nonce too low rejection",
            error: new InvalidInputRpcError(
                rpcError('nonce too low: next nonce 5, tx nonce 3'),
            ),
            code: 'nonce_too_low',
            params: {},
        },
        {
            name: "a node's unclassified insufficient funds rejection",
            error: new InvalidInputRpcError(
                rpcError('insufficient funds for gas * price + value'),
            ),
            code: 'insufficient_funds',
            params: {},
        },
        {
            name: 'a JSON-RPC limit exceeded error',
            error: wrapped(
                new LimitExceededRpcError(rpcError('rate limited', -32005)),
            ),
            code: 'rate_limited',
            params: {},
        },
        {
            name: 'an HTTP 429',
            error: wrapped(
                new HttpRequestError({ status: 429, url: URL, body: {} }),
            ),
            code: 'rate_limited',
            params: {},
        },
    ])('maps $name to $code', ({ error, code, params }) => {
        const result = toEvmError(error, 'ETH')

        expect(result).toBeInstanceOf(EvmError)
        expect(result.code).toBe(code)
        expect(result.params).toEqual({ ...params, symbol: 'ETH' })
        expect(result.metadata.messageKey).toBe(`errors.evm.${code}.body`)
        expect(result.metadata.titleKey).toBe(`errors.evm.${code}.title`)
        expect(result.metadata.params).toEqual({
            code,
            ...params,
            symbol: 'ETH',
        })
        expect(result.originalError).toBe(error)
    })

    it.each([
        { name: 'a plain Error', error: new Error('socket hang up') },
        {
            name: 'an unrecognised node error',
            error: wrapped(new UnknownNodeError({ cause: rpcError('boom') })),
        },
        { name: 'a non-Error value', error: 'kaboom' },
    ])('keeps the generic blockchain key for $name', ({ error }) => {
        const result = toEvmError(error, 'ETH')

        expect(result.code).toBe('unknown')
        expect(result.metadata.messageKey).toBe('errors.blockchain.generic')
        expect(result.metadata.titleKey).toBeUndefined()
    })

    it("names the chain's native coin in the insufficient-funds copy", () => {
        const result = toEvmError(wrapped(new InsufficientFundsError()), 'BNB')

        expect(result.code).toBe('insufficient_funds')
        expect(result.metadata.params).toMatchObject({ symbol: 'BNB' })
    })

    it('classifies as a blockchain error so crash reporting can group it', () => {
        const result = toEvmError(wrapped(new InsufficientFundsError()), 'ETH')

        expect(result).toBeInstanceOf(BlockchainError)
        expect(result.name).toBe('EvmError')
        expect(result.metadata.category).toBe(ErrorCategory.BLOCKCHAIN)
    })

    it('treats rate limiting as an expected, retryable, unreported failure', () => {
        const result = toEvmError(
            new HttpRequestError({ status: 429, url: URL }),
            'ETH',
        )

        expect(result.metadata).toMatchObject({
            severity: ErrorSeverity.LOW,
            retryable: true,
            expected: true,
        })
        expect(result.shouldReport()).toBe(false)
    })

    it('falls back to the reasonless revert when no reason is supplied', () => {
        const error = new EvmError('reverted_with_reason', { reason: '' })

        expect(error.code).toBe('reverted')
        expect(error.metadata.messageKey).toBe('errors.evm.reverted.body')
    })

    it('returns an EvmError unchanged', () => {
        const error = new EvmError('nonce_too_low')

        expect(toEvmError(error, 'ETH')).toBe(error)
    })

    describe('report codes', () => {
        it('declares evm.<code> through a wrapped viem error', () => {
            const error = toEvmError(
                wrapped(new InsufficientFundsError()),
                'ETH',
            )

            expect(error.metadata.reportCode).toBe('evm.insufficient_funds')
        })

        it('declares the resolved code, not the requested one', () => {
            const error = new EvmError('reverted_with_reason', { reason: '' })

            expect(error.metadata.reportCode).toBe('evm.reverted')
        })

        it('treats a timeout as an expected unknown failure', () => {
            const timeout = Object.assign(new Error('timed out'), {
                name: 'TimeoutError',
            })

            const error = toEvmError(timeout, 'ETH')

            expect(error.code).toBe('unknown')
            expect(isExpectedError(error)).toBe(true)
        })

        it('treats an RPC 5xx as an expected unknown failure', () => {
            const error = toEvmError(
                new HttpRequestError({ status: 503, url: URL }),
                'ETH',
            )

            expect(error.code).toBe('unknown')
            expect(isExpectedError(error)).toBe(true)
        })

        it.each([
            ['an RPC 4xx', new HttpRequestError({ status: 400, url: URL })],
            ['an unclassified failure', new Error('boom')],
        ])('keeps %s reportable', (_name, cause) => {
            expect(isExpectedError(toEvmError(cause, 'ETH'))).toBe(false)
        })
    })
})
