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

// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    AppError,
    ErrorCategory,
    IntegrityRequiredError,
    NoConnectionError,
    PeraNetworkError,
    logger,
} from '@perawallet/wallet-core-shared'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { SubmissionError, SigningError } from '@perawallet/wallet-core-signing'
import { resolveErrorCopy } from '../resolveErrorCopy'

const t = (key: string) => key
const NODE_COPY = { title: 'node title', body: 'node body' }
// Describes only the one error a test names, like a chain does for its node errors.
const getNodeErrorMessage = vi.fn(
    (_err: unknown): typeof NODE_COPY | undefined => {
        return undefined
    },
)
const describing = (described: unknown) =>
    getNodeErrorMessage.mockImplementation(err =>
        err === described ? NODE_COPY : undefined,
    )

const nodeError = () =>
    Object.assign(new Error('node rejected'), { code: 'overspend' })

beforeEach(() => {
    getNodeErrorMessage.mockReset()
    getNodeErrorMessage.mockReturnValue(undefined)
})

describe('resolveErrorCopy', () => {
    it('renders the status-unknown copy for an unverified unknown-outcome SubmissionError', () => {
        // The transaction may have landed (lost response, timeout) — calling
        // it failed or "no connection" would be a lie; the user needs to
        // check history before retrying.
        const cause = nodeError()
        describing(cause)
        const result = resolveErrorCopy(
            new SubmissionError(['TXID'], 'unknown-outcome', cause),
            t,
            undefined,
            getNodeErrorMessage,
        )

        expect(result).toEqual({
            title: 'errors.submission.unknown_outcome.title',
            body: 'errors.submission.unknown_outcome.body',
        })
    })

    it('renders the described node copy for a SubmissionError', () => {
        // A node rejection reaches the UI wrapped in SubmissionError; falling
        // into the generic AppError branch would lose the specific copy
        // (e.g. the overspend explanation).
        const cause = nodeError()
        describing(cause)
        const result = resolveErrorCopy(
            new SubmissionError(['TXID'], 'rejected-by-node', cause),
            t,
            undefined,
            getNodeErrorMessage,
        )

        expect(getNodeErrorMessage).toHaveBeenCalledWith(cause)
        expect(result).toEqual(NODE_COPY)
    })

    it('falls back to generic copy for a SubmissionError whose node error is not described', () => {
        const result = resolveErrorCopy(
            new SubmissionError(['TXID'], 'rejected-by-node', nodeError()),
            t,
            'caller title',
            getNodeErrorMessage,
        )

        expect(result).toEqual({
            title: 'caller title',
            body: 'errors.general.body',
        })
    })

    it('maps an offline PeraNetworkError to the no-connection copy', () => {
        const result = resolveErrorCopy(
            new PeraNetworkError('offline'),
            t,
            undefined,
            getNodeErrorMessage,
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
            getNodeErrorMessage,
        )

        expect(result.title).toBe('caller title')
    })

    it('maps an integrity refusal to its own copy, whatever the caller title', () => {
        const result = resolveErrorCopy(
            new IntegrityRequiredError({
                code: 'APP_INTEGRITY_TOKEN_REQUIRED',
                status: 403,
                hadToken: false,
            }),
            t,
            'Could not save',
            getNodeErrorMessage,
        )

        expect(result).toEqual({
            title: 'errors.integrity.unavailable.title',
            body: 'errors.integrity.unavailable.body',
        })
    })

    it('maps NoConnectionError to the no-connection copy', () => {
        const result = resolveErrorCopy(
            new NoConnectionError(),
            t,
            undefined,
            getNodeErrorMessage,
        )

        expect(result.title).toBe('errors.network.no_connection.title')
    })

    it('falls back to generic copy for a non-Error value', () => {
        const result = resolveErrorCopy(
            'boom',
            t,
            undefined,
            getNodeErrorMessage,
        )

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
            getNodeErrorMessage,
        )

        expect(result).toEqual({
            title: 'errors.general.title',
            body: 'errors.general.body',
        })
    })

    it('resolves a declared messageKey as the body', () => {
        const error = new AppError('log only', {
            category: ErrorCategory.VALIDATION,
            messageKey: i18nKey('errors.webview.unsupported_url'),
        })

        const result = resolveErrorCopy(
            error,
            t,
            undefined,
            getNodeErrorMessage,
        )

        expect(result.body).toBe('errors.webview.unsupported_url')
    })

    it('passes params through to the translator', () => {
        const spy = vi.fn((key: string) => key)
        const error = new AppError('log only', {
            category: ErrorCategory.VALIDATION,
            messageKey: i18nKey('errors.webview.unsupported_url'),
            params: { url: 'ABC' },
        })

        resolveErrorCopy(error, spy, undefined, getNodeErrorMessage)

        expect(spy).toHaveBeenCalledWith('errors.webview.unsupported_url', {
            url: 'ABC',
        })
    })

    it('derives the title from the error category', () => {
        const error = new AppError('log only', {
            category: ErrorCategory.ACCOUNTS,
            messageKey: i18nKey('errors.account.no_hd_wallet'),
        })

        const result = resolveErrorCopy(
            error,
            t,
            undefined,
            getNodeErrorMessage,
        )

        expect(result.title).toBe('errors.account.title')
    })

    it('resolves a described AppError by its node copy, not its inherited messageKey', () => {
        // A chain's node error can extend an AppError that carries a base
        // messageKey. If the node copy were looked up below the AppError
        // branch, the generic blockchain copy would win over the specific one.
        const error = new AppError('duplicate', {
            category: ErrorCategory.BLOCKCHAIN,
            messageKey: i18nKey('errors.blockchain.generic'),
        })
        describing(error)

        const result = resolveErrorCopy(
            error,
            t,
            undefined,
            getNodeErrorMessage,
        )

        expect(result).toEqual(NODE_COPY)
    })

    it('resolves a described plain Error by its node copy', () => {
        const rawError = new Error('node says no')
        describing(rawError)

        const result = resolveErrorCopy(
            rawError,
            t,
            undefined,
            getNodeErrorMessage,
        )

        expect(result).toEqual(NODE_COPY)
    })

    it('lets an explicit fallback title win over the category title', () => {
        const error = new AppError('log only', {
            category: ErrorCategory.ACCOUNTS,
            messageKey: i18nKey('errors.account.no_hd_wallet'),
        })

        const result = resolveErrorCopy(
            error,
            t,
            'caller title',
            getNodeErrorMessage,
        )

        expect(result.title).toBe('caller title')
    })

    it('renders a SigningError that forwards a KMS key under the signing title', () => {
        const result = resolveErrorCopy(
            new SigningError('key missing', undefined, {
                messageKey: i18nKey('errors.kms.key_not_found'),
            }),
            t,
            undefined,
            getNodeErrorMessage,
        )

        expect(result).toEqual({
            title: 'errors.signing.title',
            body: 'errors.kms.key_not_found',
        })
    })

    it('keeps a key-less SigningError on the generic banner', () => {
        const result = resolveErrorCopy(
            new SigningError('hardware path'),
            t,
            undefined,
            getNodeErrorMessage,
        )

        expect(result).toEqual({
            title: 'errors.general.title',
            body: 'errors.general.body',
        })
    })
})

describe('resolveErrorCopy generic-banner logging', () => {
    beforeEach(() => {
        vi.spyOn(logger, 'error').mockImplementation(() => {})
        vi.spyOn(logger, 'debug').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('does not log an expected error at error level', () => {
        // A plain Error, deliberately NOT a TypeError: this is the shape React
        // Native's fetch rejects with when the device is offline, and the only
        // expected-error shape that actually reaches the log line below.
        // `PeraNetworkError` returns far earlier, and a TimeoutError is mapped
        // to network_unavailable by toAlgodError before it can get here.
        resolveErrorCopy(
            new Error('Network request failed'),
            t,
            undefined,
            getNodeErrorMessage,
        )
        expect(logger.error).not.toHaveBeenCalled()
    })

    it('still logs a genuinely unrecognized error at error level', () => {
        resolveErrorCopy(
            new Error('something we have no copy for'),
            t,
            undefined,
            getNodeErrorMessage,
        )
        expect(logger.error).toHaveBeenCalledWith(
            'Unrecognized error shown as generic banner',
            expect.anything(),
        )
    })
})
