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

import { describe, it, expect, vi } from 'vitest'
import {
    AppError,
    ErrorCategory,
    NoConnectionError,
    PeraNetworkError,
} from '@perawallet/wallet-core-shared'
import { AlgodError } from '@perawallet/wallet-core-blockchain'
import { resolveErrorCopy } from '../resolveErrorCopy'

// Use the real blockchain package — this spec relies on actual AlgodError
// instanceof checks and toAlgodError parsing, which the global mock in
// vitest.setup.ts stubs out to always return unknown_node_error.
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-blockchain')
    >('@perawallet/wallet-core-blockchain')
    return actual
})

const t = (key: string) => key
const getAlgodMessage = vi.fn(() => ({
    title: 'algod title',
    body: 'algod body',
}))

describe('resolveErrorCopy', () => {
    it('maps an offline PeraNetworkError to the no-connection copy', () => {
        const result = resolveErrorCopy(
            new PeraNetworkError('offline'),
            t,
            undefined,
            getAlgodMessage,
        )

        expect(result).toEqual({
            title: 'errors.network.no_connection.title',
            body: 'errors.network.no_connection.body',
        })
    })

    it('prefers the fallback title for an unknown-kind PeraNetworkError', () => {
        const result = resolveErrorCopy(
            new PeraNetworkError('unknown'),
            t,
            'caller title',
            getAlgodMessage,
        )

        expect(result.title).toBe('caller title')
    })

    it('maps NoConnectionError to the no-connection copy', () => {
        const result = resolveErrorCopy(
            new NoConnectionError(),
            t,
            undefined,
            getAlgodMessage,
        )

        expect(result.title).toBe('errors.network.no_connection.title')
    })

    it('falls back to generic copy for a non-Error value', () => {
        const result = resolveErrorCopy('boom', t, undefined, getAlgodMessage)

        expect(result).toEqual({
            title: 'errors.general.title',
            body: 'errors.general.body',
        })
    })

    it('never surfaces the raw error message for an AppError without a messageKey', () => {
        const result = resolveErrorCopy(
            new AppError('raw detail that must not leak', {}),
            t,
            undefined,
            getAlgodMessage,
        )

        expect(result).toEqual({
            title: 'errors.general.title',
            body: 'errors.general.body',
        })
    })

    it('resolves a declared messageKey as the body', () => {
        const error = new AppError('log only', {
            category: ErrorCategory.VALIDATION,
            messageKey: 'errors.validation.invalid_address',
        })

        const result = resolveErrorCopy(error, t, undefined, getAlgodMessage)

        expect(result.body).toBe('errors.validation.invalid_address')
    })

    it('passes params through to the translator', () => {
        const spy = vi.fn((key: string) => key)
        const error = new AppError('log only', {
            category: ErrorCategory.VALIDATION,
            messageKey: 'errors.validation.invalid_address',
            params: { address: 'ABC' },
        })

        resolveErrorCopy(error, spy, undefined, getAlgodMessage)

        expect(spy).toHaveBeenCalledWith('errors.validation.invalid_address', {
            address: 'ABC',
        })
    })

    it('derives the title from the error category', () => {
        const error = new AppError('log only', {
            category: ErrorCategory.ACCOUNTS,
            messageKey: 'errors.account.no_hd_wallet',
        })

        const result = resolveErrorCopy(error, t, undefined, getAlgodMessage)

        expect(result.title).toBe('errors.account.title')
    })

    it('resolves an AlgodError via getAlgodMessage, not the inherited BlockchainError messageKey', () => {
        // AlgodError extends BlockchainError, which now carries a base
        // messageKey (errors.blockchain.generic). If this branch were ever
        // moved below the AppError branch, the error would match `instanceof
        // AppError` first and render generic blockchain copy instead of the
        // algod-specific message.
        const error = new AlgodError('duplicate_txn', { txId: 'ABC' })

        const result = resolveErrorCopy(error, t, undefined, getAlgodMessage)

        expect(getAlgodMessage).toHaveBeenCalledWith(error)
        expect(result).toEqual({ title: 'algod title', body: 'algod body' })
    })

    it('resolves a recognized algod raw Error via getAlgodMessage', () => {
        // toAlgodError() recognizes this message and assigns it a non-
        // "unknown_node_error" code, so it must route through getAlgodMessage
        // rather than falling into the generic-copy branch below.
        const rawError = new Error(
            `transaction already in ledger: ${'A'.repeat(52)}`,
        )

        const result = resolveErrorCopy(rawError, t, undefined, getAlgodMessage)

        expect(getAlgodMessage).toHaveBeenCalled()
        expect(result).toEqual({ title: 'algod title', body: 'algod body' })
    })

    it('lets an explicit fallback title win over the category title', () => {
        const error = new AppError('log only', {
            category: ErrorCategory.ACCOUNTS,
            messageKey: 'errors.account.no_hd_wallet',
        })

        const result = resolveErrorCopy(
            error,
            t,
            'caller title',
            getAlgodMessage,
        )

        expect(result.title).toBe('caller title')
    })
})
