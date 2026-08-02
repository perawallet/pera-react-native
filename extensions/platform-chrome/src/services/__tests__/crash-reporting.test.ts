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

import { afterEach, describe, expect, it, vi } from 'vitest'

const { sentryInitMock, captureExceptionMock } = vi.hoisted(() => ({
    sentryInitMock: vi.fn(),
    captureExceptionMock: vi.fn(),
}))
vi.mock('@sentry/browser', () => ({
    init: sentryInitMock,
    captureException: captureExceptionMock,
}))

const configMock = vi.hoisted(() => ({
    config: {
        sentryDsn: '',
        appEnvironment: 'development' as const,
        releaseTag: '',
    },
    isDebug: true,
}))
vi.mock('@perawallet/wallet-core-config', () => configMock)

import { ChromeCrashReportingService } from '../crash-reporting'

describe('ChromeCrashReportingService', () => {
    afterEach(() => {
        vi.clearAllMocks()
        configMock.config.sentryDsn = ''
        configMock.config.appEnvironment = 'development'
        configMock.isDebug = true
    })

    it('does not initialize Sentry in a debug build', () => {
        configMock.isDebug = true
        configMock.config.sentryDsn = 'https://key@o0.ingest.sentry.io/0'
        new ChromeCrashReportingService().initializeCrashReporting()
        expect(sentryInitMock).not.toHaveBeenCalled()
    })

    it('does not initialize Sentry when sentryDsn is unset', () => {
        configMock.isDebug = false
        configMock.config.sentryDsn = ''
        new ChromeCrashReportingService().initializeCrashReporting()
        expect(sentryInitMock).not.toHaveBeenCalled()
    })

    it('initializes Sentry on a signed build with a DSN configured', () => {
        configMock.isDebug = false
        configMock.config.sentryDsn = 'https://key@o0.ingest.sentry.io/0'
        configMock.config.appEnvironment = 'production'
        new ChromeCrashReportingService().initializeCrashReporting()

        expect(sentryInitMock).toHaveBeenCalledWith(
            expect.objectContaining({
                dsn: 'https://key@o0.ingest.sentry.io/0',
                environment: 'production',
            }),
        )
    })

    it('forwards errors to Sentry once initialized', () => {
        configMock.isDebug = false
        configMock.config.sentryDsn = 'https://key@o0.ingest.sentry.io/0'
        const service = new ChromeCrashReportingService()
        service.initializeCrashReporting()

        const error = new Error('boom')
        service.recordNonFatalError(error)
        expect(captureExceptionMock).toHaveBeenCalledWith(error)
    })

    it('wraps non-Error values before forwarding', () => {
        configMock.isDebug = false
        configMock.config.sentryDsn = 'https://key@o0.ingest.sentry.io/0'
        const service = new ChromeCrashReportingService()
        service.initializeCrashReporting()

        service.recordNonFatalError('a string error')
        expect(captureExceptionMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'a string error' }),
        )
    })

    it('never throws when uninitialized (falls back to console.error)', () => {
        const service = new ChromeCrashReportingService()
        expect(() => service.recordNonFatalError(new Error('x'))).not.toThrow()
        expect(captureExceptionMock).not.toHaveBeenCalled()
    })
})

// Nothing logs key material today, so these guard the invariant rather than a
// known leak: one careless console.log or a signing error whose message quotes
// its payload would otherwise ship a secret to a third party.
describe('event scrubbing before send', () => {
    const initAndGetOptions = (): {
        beforeSend: (event: Record<string, unknown>) => Record<string, unknown>
        integrations: (
            defaults: Array<{ name: string }>,
        ) => Array<{ name: string }>
        sendDefaultPii: boolean
    } => {
        configMock.config.sentryDsn = 'https://key@example.ingest.sentry.io/1'
        configMock.isDebug = false
        new ChromeCrashReportingService().initializeCrashReporting()
        return sentryInitMock.mock.calls[0][0]
    }

    afterEach(() => {
        configMock.isDebug = true
    })

    it('drops the free-form containers entirely', () => {
        const { beforeSend } = initAndGetOptions()

        const scrubbed = beforeSend({
            extra: { seed: 'anything' },
            contexts: { device: {} },
            breadcrumbs: [{ message: 'console output' }],
            request: { url: 'https://x' },
            user: { id: 'abc' },
        })

        expect(scrubbed.extra).toBeUndefined()
        expect(scrubbed.contexts).toBeUndefined()
        expect(scrubbed.breadcrumbs).toBeUndefined()
        expect(scrubbed.request).toBeUndefined()
        expect(scrubbed.user).toBeUndefined()
    })

    it('redacts a mnemonic that reached an exception message', () => {
        const { beforeSend } = initAndGetOptions()
        const phrase =
            'abandon ability able about above absent absorb abstract absurd abuse access accident'

        const scrubbed = beforeSend({
            exception: { values: [{ value: `failed to import ${phrase}` }] },
        }) as { exception: { values: Array<{ value: string }> } }

        expect(scrubbed.exception.values[0].value).not.toContain('abandon')
        expect(scrubbed.exception.values[0].value).toContain(
            '[redacted-phrase]',
        )
    })

    it.each([
        ['base64 key', 'c2VjcmV0'.repeat(8)],
        ['hex seed', 'a1b2c3d4'.repeat(9)],
    ])('redacts a %s in the message', (_label, secret) => {
        const { beforeSend } = initAndGetOptions()

        const scrubbed = beforeSend({ message: `boom ${secret}` }) as {
            message: string
        }

        expect(scrubbed.message).not.toContain(secret)
        expect(scrubbed.message).toContain('boom')
    })

    it('leaves ordinary diagnostics readable', () => {
        const { beforeSend } = initAndGetOptions()

        const scrubbed = beforeSend({
            message: 'Offscreen database host unavailable after 15s',
        }) as { message: string }

        expect(scrubbed.message).toBe(
            'Offscreen database host unavailable after 15s',
        )
    })

    it('removes the console and fetch breadcrumb integrations', () => {
        const { integrations, sendDefaultPii } = initAndGetOptions()

        const kept = integrations([
            { name: 'Breadcrumbs' },
            { name: 'BrowserApiErrors' },
            { name: 'GlobalHandlers' },
        ]).map(i => i.name)

        expect(kept).toEqual(['GlobalHandlers'])
        expect(sendDefaultPii).toBe(false)
    })
})
