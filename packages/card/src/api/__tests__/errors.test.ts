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
    getCardApiError,
    isConflictError,
    isInvalidInputError,
    isDuplicateError,
    isNotVerifiedError,
} from '../errors'

describe('getCardApiError', () => {
    it('returns an empty result for a non-object error', async () => {
        expect(await getCardApiError('boom')).toEqual({ status: undefined })
        expect(await getCardApiError(null)).toEqual({ status: undefined })
    })

    it('extracts the status when there is no readable body', async () => {
        const error = { response: { status: 409 } }

        expect(await getCardApiError(error)).toEqual({ status: 409 })
    })

    it("reads ky's pre-parsed (and body-consuming) error.data object", async () => {
        // ky consumes the body into `error.data`, so response.json() is dead.
        const error = {
            response: { status: 409 },
            data: { message: 'That email is already in use' },
        }

        expect(await getCardApiError(error)).toEqual({
            status: 409,
            code: undefined,
            message: 'That email is already in use',
        })
    })

    it('treats a plain-text error.data as the message', async () => {
        const error = { response: { status: 400 }, data: 'Bad request' }

        expect(await getCardApiError(error)).toEqual({
            status: 400,
            message: 'Bad request',
        })
    })

    it('parses code and message from the response body', async () => {
        const error = {
            response: {
                status: 422,
                json: vi.fn().mockResolvedValue({
                    code: 'EMAIL_TAKEN',
                    message: 'That email is already registered',
                }),
            },
        }

        expect(await getCardApiError(error)).toEqual({
            status: 422,
            code: 'EMAIL_TAKEN',
            message: 'That email is already registered',
        })
    })

    it('reads alternate body field names', async () => {
        const error = {
            response: {
                status: 400,
                json: vi.fn().mockResolvedValue({
                    errorCode: 'INVALID_CODE',
                    detail: 'The code has expired',
                }),
            },
        }

        expect(await getCardApiError(error)).toEqual({
            status: 400,
            code: 'INVALID_CODE',
            message: 'The code has expired',
        })
    })

    it('prefers clone() so the original stream is untouched', async () => {
        const json = vi.fn().mockResolvedValue({ code: 'X' })
        const originalJson = vi.fn()
        const error = {
            response: {
                status: 409,
                clone: () => ({ json }),
                json: originalJson,
            },
        }

        const result = await getCardApiError(error)

        expect(result.code).toBe('X')
        expect(json).toHaveBeenCalledOnce()
        expect(originalJson).not.toHaveBeenCalled()
    })

    it('falls back to status only when body parsing throws', async () => {
        const error = {
            response: {
                status: 500,
                json: vi.fn().mockRejectedValue(new Error('not json')),
            },
        }

        expect(await getCardApiError(error)).toEqual({ status: 500 })
    })

    it("unwraps Baanx's nested-stringified error object", async () => {
        // Baanx returns the real error JSON-encoded inside `message`.
        const error = {
            response: { status: 500 },
            data: {
                message: JSON.stringify({
                    error: {
                        status: 500,
                        message:
                            'Something went wrong, please contact support.',
                        errorCode: null,
                    },
                }),
            },
        }

        expect(await getCardApiError(error)).toEqual({
            status: 500,
            code: undefined,
            message: 'Something went wrong, please contact support.',
        })
    })

    it('unwraps a nested-stringified duplicate error (string + details)', async () => {
        const error = {
            response: { status: 409 },
            data: {
                message: JSON.stringify({
                    error: 'Duplicate onboardingId',
                    details: [
                        "A consent set with onboardingId 'abc' already exists",
                    ],
                }),
            },
        }

        expect(await getCardApiError(error)).toEqual({
            status: 409,
            code: 'Duplicate onboardingId',
            message: "A consent set with onboardingId 'abc' already exists",
        })
    })

    it('keeps the original message when it looks like JSON but does not parse', async () => {
        const error = {
            response: { status: 500 },
            data: { message: '{not valid json' },
        }

        expect(await getCardApiError(error)).toEqual({
            status: 500,
            code: undefined,
            message: '{not valid json',
        })
    })
})

describe('isConflictError', () => {
    it.each([409, 422])('is true for %i', status => {
        expect(isConflictError({ status })).toBe(true)
    })

    it.each([400, 404, 500, undefined])('is false for %s', status => {
        expect(isConflictError({ status })).toBe(false)
    })
})

describe('isInvalidInputError', () => {
    it.each([400, 422])('is true for %i', status => {
        expect(isInvalidInputError({ status })).toBe(true)
    })

    it.each([409, 404, 500, undefined])('is false for %s', status => {
        expect(isInvalidInputError({ status })).toBe(false)
    })
})

describe('isDuplicateError', () => {
    it('is true when the code or message signals an existing record', () => {
        expect(isDuplicateError({ code: 'Duplicate onboardingId' })).toBe(true)
        expect(
            isDuplicateError({
                message: 'A consent set with onboardingId abc already exists',
            }),
        ).toBe(true)
    })

    it('is false for unrelated failures', () => {
        expect(isDuplicateError({ status: 500, message: 'boom' })).toBe(false)
        expect(isDuplicateError({})).toBe(false)
    })
})

describe('isNotVerifiedError', () => {
    it('matches the documented code and the observed sandbox message', () => {
        expect(isNotVerifiedError({ code: 'USER_NOT_VERIFIED' })).toBe(true)
        expect(
            isNotVerifiedError({
                status: 403,
                message: 'Account has not been verified',
            }),
        ).toBe(true)
        expect(isNotVerifiedError({ message: 'User is not verified' })).toBe(
            true,
        )
    })

    it('is false for unrelated failures', () => {
        expect(isNotVerifiedError({ status: 403, message: 'Forbidden' })).toBe(
            false,
        )
        expect(isNotVerifiedError({})).toBe(false)
    })
})
