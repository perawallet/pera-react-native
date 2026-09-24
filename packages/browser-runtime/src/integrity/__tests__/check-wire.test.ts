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
    INTEGRITY_CHECK_MESSAGE_TYPE,
    INTEGRITY_ENROL_SCOPE,
    INTEGRITY_FRAME_MESSAGE_TYPE,
    buildCheckUrl,
    frameEventFor,
    isCheckToken,
    isIntegrityEnrolRequest,
    isRetryableCheckError,
    parseCheckPageMessage,
    parseCheckPortMessage,
    parseIntegrityEnrolDecision,
    parseIntegrityFrameMessage,
    toCheckPortMessage,
} from '../check-wire'

const KID = 'k'.repeat(43)
const page = (fields: Record<string, unknown>) => ({
    type: INTEGRITY_CHECK_MESSAGE_TYPE,
    v: 1,
    kid: KID,
    ...fields,
})

describe('check wire', () => {
    it('builds the check URL with the version, kid and token', () => {
        const url = new URL(
            buildCheckUrl({
                origin: 'https://integrity-staging.perawallet.app',
                kid: KID,
                token: 't'.repeat(22),
            }),
        )

        expect(url.origin + url.pathname).toBe(
            'https://integrity-staging.perawallet.app/check',
        )
        expect(url.searchParams.get('v')).toBe('1')
        expect(url.searchParams.get('kid')).toBe(KID)
        expect(url.searchParams.get('peraCheckToken')).toBe('t'.repeat(22))
    })

    it.each([
        ['a 22 character token', 't'.repeat(22), true],
        ['too short', 't'.repeat(21), false],
        ['a disallowed character', `${'t'.repeat(21)}/`, false],
        ['not a string', 42, false],
    ])('accepts check tokens: %s', (_label, value, expected) => {
        expect(isCheckToken(value)).toBe(expected)
    })

    it('parses every page event the check page sends', () => {
        expect(parseCheckPageMessage(page({ event: 'hello' }))).toEqual({
            event: 'hello',
            kid: KID,
        })
        expect(
            parseCheckPageMessage(
                page({ event: 'solved', turnstileToken: 'tok' }),
            ),
        ).toEqual({ event: 'solved', kid: KID, turnstileToken: 'tok' })
        expect(
            parseCheckPageMessage(
                page({
                    event: 'error',
                    code: 'TURNSTILE_ERROR',
                    detail: '600010',
                }),
            ),
        ).toEqual({
            event: 'error',
            kid: KID,
            code: 'TURNSTILE_ERROR',
            detail: '600010',
        })
    })

    it.each([
        ['the content script own ready', page({ event: 'ready' })],
        ['another type', { ...page({ event: 'hello' }), type: 'other' }],
        ['another version', { ...page({ event: 'hello' }), v: 2 }],
        ['a solve with no token', page({ event: 'solved' })],
        ['an error with no code', page({ event: 'error' })],
        ['Turnstile iframe traffic', { event: 'init', widgetId: 'x' }],
    ])('ignores %s', (_label, data) => {
        expect(parseCheckPageMessage(data)).toBeNull()
    })

    it('maps hello to PAGE_READY and a solve to TURNSTILE_SOLVED', () => {
        expect(toCheckPortMessage({ event: 'hello', kid: KID })).toEqual({
            type: 'PAGE_READY',
            v: 1,
            kid: KID,
        })
        expect(
            toCheckPortMessage({
                event: 'solved',
                kid: KID,
                turnstileToken: 'tok',
            }),
        ).toEqual({
            type: 'TURNSTILE_SOLVED',
            v: 1,
            kid: KID,
            turnstileToken: 'tok',
        })
    })

    it('tells the host page to expand, collapse or remove the frame', () => {
        expect(frameEventFor({ event: 'interactive-required', kid: KID })).toBe(
            'expand',
        )
        expect(frameEventFor({ event: 'interactive-done', kid: KID })).toBe(
            'collapse',
        )
        expect(
            frameEventFor({ event: 'solved', kid: KID, turnstileToken: 't' }),
        ).toBe('finished')
        expect(frameEventFor({ event: 'error', kid: KID, code: 'X' })).toBe(
            'finished',
        )
        expect(frameEventFor({ event: 'hello', kid: KID })).toBeNull()
    })

    it.each([
        ['an empty token', ''],
        ['a token over 2048 characters', 'x'.repeat(2049)],
    ])('rejects a port solve with %s', (_label, turnstileToken) => {
        expect(
            parseCheckPortMessage({
                type: 'TURNSTILE_SOLVED',
                v: 1,
                kid: KID,
                turnstileToken,
            }),
        ).toBeNull()
    })

    it('parses frame messages for the host page', () => {
        expect(
            parseIntegrityFrameMessage({
                type: INTEGRITY_FRAME_MESSAGE_TYPE,
                v: 1,
                event: 'expand',
            }),
        ).toEqual({ type: INTEGRITY_FRAME_MESSAGE_TYPE, v: 1, event: 'expand' })
        expect(
            parseIntegrityFrameMessage({
                type: INTEGRITY_FRAME_MESSAGE_TYPE,
                v: 1,
                event: 'open',
            }),
        ).toBeNull()
    })

    it.each([
        ['UNSUPPORTED_VERSION', undefined, false],
        ['INVALID_KID', undefined, false],
        ['TURNSTILE_ERROR', 'no-sitekey-for-host', false],
        ['TURNSTILE_ERROR', '600010', true],
        ['TURNSTILE_EXPIRED', 'interactive-timeout', true],
    ])(
        'knows whether %s (%s) can succeed on a retry',
        (code, detail, expected) => {
            expect(isRetryableCheckError(code, detail)).toBe(expected)
        },
    )

    it('recognises an enrol request and parses the decision', () => {
        expect(
            isIntegrityEnrolRequest({
                scope: INTEGRITY_ENROL_SCOPE,
                kind: 'request',
                reason: 'page-open',
            }),
        ).toBe(true)
        expect(
            isIntegrityEnrolRequest({
                scope: INTEGRITY_ENROL_SCOPE,
                kind: 'request',
                reason: 'x',
            }),
        ).toBe(false)
        expect(
            parseIntegrityEnrolDecision({
                action: 'host',
                url: 'u',
                deadlineAt: 1,
            }),
        ).toEqual({
            action: 'host',
            url: 'u',
            deadlineAt: 1,
        })
        expect(parseIntegrityEnrolDecision(undefined)).toEqual({
            action: 'none',
        })
    })
})
