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

import { describe, test, expect, vi } from 'vitest'
import { createCrashReportingErrorReporter } from '../utils'

describe('createCrashReportingErrorReporter', () => {
    test('reports when severity is error', () => {
        const recordNonFatalError = vi.fn()
        const reporter = createCrashReportingErrorReporter({
            recordNonFatalError,
        })
        const error = new Error('boom')

        reporter({ severity: 'error', error })

        // Second argument is the optional groupingKey, absent here.
        expect(recordNonFatalError).toHaveBeenCalledWith(error, undefined)
    })

    test('reports when severity is critical', () => {
        const recordNonFatalError = vi.fn()
        const reporter = createCrashReportingErrorReporter({
            recordNonFatalError,
        })
        const error = new Error('critical')

        reporter({ severity: 'critical', error })

        expect(recordNonFatalError).toHaveBeenCalledWith(error, undefined)
    })

    test('forwards groupingKey to the adapter', () => {
        const recordNonFatalError = vi.fn()
        const reporter = createCrashReportingErrorReporter({
            recordNonFatalError,
        })
        const error = new Error('boom')

        reporter({
            severity: 'error',
            error,
            groupingKey: 'Request error encountered',
        })

        expect(recordNonFatalError).toHaveBeenCalledWith(
            error,
            'Request error encountered',
        )
    })

    test('does not report when severity is non-error', () => {
        const recordNonFatalError = vi.fn()
        const reporter = createCrashReportingErrorReporter({
            recordNonFatalError,
        })

        reporter({ severity: 'warn', error: new Error('warn') })

        expect(recordNonFatalError).not.toHaveBeenCalled()
    })

    test('falls back to recordError for compatibility', () => {
        const recordError = vi.fn()
        const reporter = createCrashReportingErrorReporter({
            recordError,
        })
        const error = new Error('fallback')

        reporter({ severity: 'error', error })

        expect(recordError).toHaveBeenCalledWith(error)
    })

    test('swallows crash reporting exceptions', () => {
        const reporter = createCrashReportingErrorReporter({
            recordNonFatalError: () => {
                throw new Error('reporting failed')
            },
        })

        expect(() => {
            reporter({ severity: 'error', error: new Error('boom') })
        }).not.toThrow()
    })

    test('routes expected severity to logBreadcrumb, not recordNonFatalError', () => {
        const logBreadcrumb = vi.fn()
        const recordNonFatalError = vi.fn()
        const reporter = createCrashReportingErrorReporter({
            logBreadcrumb,
            recordNonFatalError,
        })

        reporter({
            severity: 'expected',
            error: new Error('offline'),
            groupingKey: 'Request did not complete',
        })

        expect(logBreadcrumb).toHaveBeenCalledTimes(1)
        expect(recordNonFatalError).not.toHaveBeenCalled()
    })

    // The common downgraded shape, not a hypothetical: most sites log a
    // constant string message, and the logger only sets `groupingKey` on that
    // string path — so the breadcrumb is what names the site.
    test('includes the grouping key and message in the breadcrumb', () => {
        const logBreadcrumb = vi.fn()
        const reporter = createCrashReportingErrorReporter({ logBreadcrumb })

        reporter({
            severity: 'expected',
            error: new Error('socket closed'),
            groupingKey: 'WC transport',
        })

        expect(logBreadcrumb).toHaveBeenCalledWith(
            expect.stringContaining('WC transport'),
        )
        expect(logBreadcrumb).toHaveBeenCalledWith(
            expect.stringContaining('socket closed'),
        )
    })

    test('error severity never reaches logBreadcrumb', () => {
        const logBreadcrumb = vi.fn()
        const recordNonFatalError = vi.fn()
        const reporter = createCrashReportingErrorReporter({
            logBreadcrumb,
            recordNonFatalError,
        })

        reporter({ severity: 'error', error: new Error('real') })

        expect(recordNonFatalError).toHaveBeenCalledTimes(1)
        expect(logBreadcrumb).not.toHaveBeenCalled()
    })

    test('a throwing logBreadcrumb never escapes', () => {
        const reporter = createCrashReportingErrorReporter({
            logBreadcrumb: () => {
                throw new Error('native boom')
            },
        })

        expect(() =>
            reporter({ severity: 'expected', error: new Error('offline') }),
        ).not.toThrow()
    })
})
