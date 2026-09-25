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

// Pure wire for the Turnstile check page: constants, types, parsers and a URL
// builder shared by the content script (relaying window.postMessage to a
// runtime port) and the service worker (the port's other end). No chrome.*
// and no side-effect imports, so content-wire.ts can bundle this into the
// content-script build.

export const INTEGRITY_CHECK_MESSAGE_TYPE = 'pera:integrity-check'
export const INTEGRITY_FRAME_MESSAGE_TYPE = 'pera:integrity-frame'
export const INTEGRITY_CHECK_VERSION = 1
export const INTEGRITY_CHECK_PATH = '/check'
export const INTEGRITY_CHECK_TOKEN_PARAM = 'peraCheckToken'
export const INTEGRITY_CHECK_PORT_PREFIX = 'pera-integrity-check:'
export const INTEGRITY_HOST_PORT_PREFIX = 'pera-integrity-host:'
export const INTEGRITY_ENROL_SCOPE = 'pera-integrity-enrol'
export const MAX_TURNSTILE_TOKEN_LENGTH = 2048

const CHECK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,64}$/

export type CheckPageMessage =
    | {
          event: 'hello' | 'interactive-required' | 'interactive-done'
          kid: string
      }
    | { event: 'solved'; kid: string; turnstileToken: string }
    | { event: 'error'; kid: string; code: string; detail?: string }

export type IntegrityCheckPortMessage =
    | { type: 'PAGE_READY'; v: 1; kid: string }
    | { type: 'INTERACTIVE_REQUIRED'; v: 1; kid: string }
    | { type: 'INTERACTIVE_DONE'; v: 1; kid: string }
    | { type: 'TURNSTILE_SOLVED'; v: 1; kid: string; turnstileToken: string }
    | {
          type: 'TURNSTILE_ERROR'
          v: 1
          kid: string
          code: string
          detail?: string
      }

export type IntegrityFrameEvent = 'expand' | 'collapse' | 'finished'

export type IntegrityFrameMessage = {
    type: typeof INTEGRITY_FRAME_MESSAGE_TYPE
    v: typeof INTEGRITY_CHECK_VERSION
    event: IntegrityFrameEvent
}

export type IntegrityEnrolReason =
    | 'page-open'
    | 'onboarding-complete'
    | 'enrolment-needed'

export type IntegrityEnrolRequest = {
    scope: typeof INTEGRITY_ENROL_SCOPE
    kind: 'request'
    reason: IntegrityEnrolReason
}

export type IntegrityEnrolDecision =
    | { action: 'none' }
    | { action: 'host'; url: string; deadlineAt: number }

const ENROL_REASONS: readonly string[] = [
    'page-open',
    'onboarding-complete',
    'enrolment-needed',
]
const FRAME_EVENTS: readonly string[] = ['expand', 'collapse', 'finished']

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

export const isCheckToken = (value: unknown): value is string =>
    typeof value === 'string' && CHECK_TOKEN_PATTERN.test(value)

export const buildCheckUrl = ({
    origin,
    kid,
    token,
}: {
    origin: string
    kid: string
    token: string
}): string => {
    const url = new URL(INTEGRITY_CHECK_PATH, origin)
    url.searchParams.set('v', String(INTEGRITY_CHECK_VERSION))
    url.searchParams.set('kid', kid)
    url.searchParams.set(INTEGRITY_CHECK_TOKEN_PARAM, token)
    return url.toString()
}

export const parseCheckPageMessage = (
    data: unknown,
): CheckPageMessage | null => {
    if (!isRecord(data)) return null
    if (data.type !== INTEGRITY_CHECK_MESSAGE_TYPE) return null
    if (data.v !== INTEGRITY_CHECK_VERSION) return null
    if (typeof data.kid !== 'string') return null
    const kid = data.kid
    switch (data.event) {
        case 'hello': {
            return { event: 'hello', kid }
        }
        case 'interactive-required': {
            return { event: 'interactive-required', kid }
        }
        case 'interactive-done': {
            return { event: 'interactive-done', kid }
        }
        case 'solved': {
            return typeof data.turnstileToken === 'string'
                ? { event: 'solved', kid, turnstileToken: data.turnstileToken }
                : null
        }
        case 'error': {
            if (typeof data.code !== 'string') return null
            return typeof data.detail === 'string'
                ? { event: 'error', kid, code: data.code, detail: data.detail }
                : { event: 'error', kid, code: data.code }
        }
        default: {
            return null
        }
    }
}

export const toCheckPortMessage = (
    message: CheckPageMessage,
): IntegrityCheckPortMessage => {
    const v = INTEGRITY_CHECK_VERSION
    switch (message.event) {
        case 'hello': {
            return { type: 'PAGE_READY', v, kid: message.kid }
        }
        case 'interactive-required': {
            return { type: 'INTERACTIVE_REQUIRED', v, kid: message.kid }
        }
        case 'interactive-done': {
            return { type: 'INTERACTIVE_DONE', v, kid: message.kid }
        }
        case 'solved': {
            return {
                type: 'TURNSTILE_SOLVED',
                v,
                kid: message.kid,
                turnstileToken: message.turnstileToken,
            }
        }
        case 'error': {
            return message.detail === undefined
                ? {
                      type: 'TURNSTILE_ERROR',
                      v,
                      kid: message.kid,
                      code: message.code,
                  }
                : {
                      type: 'TURNSTILE_ERROR',
                      v,
                      kid: message.kid,
                      code: message.code,
                      detail: message.detail,
                  }
        }
    }
}

export const frameEventFor = (
    message: CheckPageMessage,
): IntegrityFrameEvent | null => {
    switch (message.event) {
        case 'interactive-required': {
            return 'expand'
        }
        case 'interactive-done': {
            return 'collapse'
        }
        case 'solved':
        case 'error': {
            return 'finished'
        }
        default: {
            return null
        }
    }
}

export const parseCheckPortMessage = (
    data: unknown,
): IntegrityCheckPortMessage | null => {
    if (!isRecord(data)) return null
    if (data.v !== INTEGRITY_CHECK_VERSION) return null
    if (typeof data.kid !== 'string') return null
    const v = INTEGRITY_CHECK_VERSION
    const kid = data.kid
    switch (data.type) {
        case 'PAGE_READY': {
            return { type: 'PAGE_READY', v, kid }
        }
        case 'INTERACTIVE_REQUIRED': {
            return { type: 'INTERACTIVE_REQUIRED', v, kid }
        }
        case 'INTERACTIVE_DONE': {
            return { type: 'INTERACTIVE_DONE', v, kid }
        }
        case 'TURNSTILE_SOLVED': {
            const token = data.turnstileToken
            return typeof token === 'string' &&
                token.length > 0 &&
                token.length <= MAX_TURNSTILE_TOKEN_LENGTH
                ? { type: 'TURNSTILE_SOLVED', v, kid, turnstileToken: token }
                : null
        }
        case 'TURNSTILE_ERROR': {
            if (typeof data.code !== 'string') return null
            return typeof data.detail === 'string'
                ? {
                      type: 'TURNSTILE_ERROR',
                      v,
                      kid,
                      code: data.code,
                      detail: data.detail,
                  }
                : { type: 'TURNSTILE_ERROR', v, kid, code: data.code }
        }
        default: {
            return null
        }
    }
}

export const parseIntegrityFrameMessage = (
    data: unknown,
): IntegrityFrameMessage | null =>
    isRecord(data) &&
    data.type === INTEGRITY_FRAME_MESSAGE_TYPE &&
    data.v === INTEGRITY_CHECK_VERSION &&
    typeof data.event === 'string' &&
    FRAME_EVENTS.includes(data.event)
        ? {
              type: INTEGRITY_FRAME_MESSAGE_TYPE,
              v: INTEGRITY_CHECK_VERSION,
              event: data.event as IntegrityFrameEvent,
          }
        : null

// These fail identically on every retry, whatever the user does.
export const isRetryableCheckError = (code: string, detail?: string): boolean =>
    code !== 'UNSUPPORTED_VERSION' &&
    code !== 'INVALID_KID' &&
    detail !== 'no-sitekey-for-host'

export const isIntegrityEnrolRequest = (
    message: unknown,
): message is IntegrityEnrolRequest =>
    isRecord(message) &&
    message.scope === INTEGRITY_ENROL_SCOPE &&
    message.kind === 'request' &&
    typeof message.reason === 'string' &&
    ENROL_REASONS.includes(message.reason)

export const parseIntegrityEnrolDecision = (
    value: unknown,
): IntegrityEnrolDecision =>
    isRecord(value) &&
    value.action === 'host' &&
    typeof value.url === 'string' &&
    typeof value.deadlineAt === 'number'
        ? { action: 'host', url: value.url, deadlineAt: value.deadlineAt }
        : { action: 'none' }
