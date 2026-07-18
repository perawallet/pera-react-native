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
