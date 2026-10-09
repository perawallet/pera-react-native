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
} from '@perawallet/wallet-core-shared'
import { EVM_ERROR_I18N_KEYS, EvmError, toEvmError } from '..'

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
        const result = toEvmError(error)

        expect(result).toBeInstanceOf(EvmError)
        expect(result.code).toBe(code)
        expect(result.params).toEqual(params)
        expect(result.metadata.messageKey).toBe(`errors.evm.${code}.body`)
        expect(result.metadata.titleKey).toBe(`errors.evm.${code}.title`)
        expect(result.metadata.params).toEqual({ code, ...params })
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
        const result = toEvmError(error)

        expect(result.code).toBe('unknown')
        expect(result.metadata.messageKey).toBe('errors.blockchain.generic')
        expect(result.metadata.titleKey).toBeUndefined()
    })

    it('classifies as a blockchain error so crash reporting can group it', () => {
        const result = toEvmError(wrapped(new InsufficientFundsError()))

        expect(result).toBeInstanceOf(BlockchainError)
        expect(result.name).toBe('EvmError')
        expect(result.metadata.category).toBe(ErrorCategory.BLOCKCHAIN)
    })

    it('treats rate limiting as an expected, retryable, unreported failure', () => {
        const result = toEvmError(
            new HttpRequestError({ status: 429, url: URL }),
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

        expect(toEvmError(error)).toBe(error)
    })

    it('lists a title and body key for every mapped code', () => {
        expect(EVM_ERROR_I18N_KEYS).toHaveLength(14)
        expect(EVM_ERROR_I18N_KEYS).toContain('errors.evm.rate_limited.body')
        expect(EVM_ERROR_I18N_KEYS).not.toContain('errors.blockchain.generic')
    })
})
