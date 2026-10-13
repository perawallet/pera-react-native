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

import { config } from '@perawallet/wallet-core-config'
import { isExpectedError } from '../errors/expected'
import {
    readSafely,
    redactErrorForReport,
    type ErrorReporter,
    type LogErrorSeverity,
} from './error-report'
import {
    redactContextError,
    redactMaybeString,
    redactSensitiveContext,
    redactSensitiveUrl,
    type LogContext,
} from './redaction'
import type { Nullable, Optional } from './types'

/**
 * Log levels for controlling log output and error reporting
 * Ordered by severity: DEBUG < INFO < WARN < ERROR < CRITICAL
 */
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4,
} as const

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel]

const LOG_LEVEL_NAMES = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.CRITICAL]: 'CRITICAL',
}

class Logger {
    private level: LogLevel = LogLevel.INFO // Default safe level
    private errorReporter: Nullable<ErrorReporter> = null

    constructor() {
        // Initialize level based on config
        // In a real app we might load this from a remote config or local storage
        if (config.debugEnabled) {
            this.level = LogLevel.DEBUG
        }
    }

    /**
     * Set the minimum log level for output
     */
    public setLevel(level: LogLevel) {
        this.level = level
    }

    public setErrorReporter(reporter?: Nullable<ErrorReporter>) {
        this.errorReporter = reporter ?? null
    }

    public debug(message: string, context?: LogContext) {
        this.log(LogLevel.DEBUG, message, context)
    }

    public info(message: string, context?: LogContext) {
        this.log(LogLevel.INFO, message, context)
    }

    public warn(message: string, context?: LogContext) {
        this.log(LogLevel.WARN, message, context)
    }

    public error(
        error: Error | string,
        context?: LogContext,
        options?: { force?: boolean },
    ) {
        // A site that already knows better can opt out; everything else is
        // classified centrally so the policy stays in one reviewable place.
        //
        // The context is classified too because most call sites pass a constant
        // string plus `{ error }` (the query cache's 'Query failed: …'
        // being the one every algod and indexer failure reaches). Judging only
        // the first argument would leave the policy inert at the majority of
        // sites, including every transport timeout and 5xx.
        if (
            !options?.force &&
            (isExpectedError(error) ||
                isExpectedError(this.findContextError(context)))
        ) {
            this.log(LogLevel.WARN, error, context, 'expected')
            return
        }
        this.log(LogLevel.ERROR, error, context)
    }

    public critical(error: Error | string, context?: LogContext) {
        this.log(LogLevel.CRITICAL, error, context)
    }

    private formatContext(context: LogContext): LogContext {
        const redacted = redactSensitiveContext(context)
        const formatted: LogContext = {}
        for (const [key, value] of Object.entries(redacted)) {
            formatted[key] =
                value instanceof Error ? redactContextError(value) : value
        }
        return formatted
    }

    private stringifyContext(context?: LogContext): string {
        if (!context) {
            return ''
        }

        try {
            return JSON.stringify(this.formatContext(context))
        } catch {
            return '[unserializable context]'
        }
    }

    private reportError(
        severity: LogErrorSeverity,
        messageOrError: string | Error,
        context?: LogContext,
    ) {
        if (!this.errorReporter) {
            return
        }

        try {
            if (messageOrError instanceof Error && !context) {
                this.errorReporter({
                    severity,
                    error: redactErrorForReport(messageOrError),
                })
                return
            }

            // String(): `message` is typed as a string but a native module can
            // set it to anything, and the report's message must stay one —
            // `new Error(<non-string>)` stringified it the same way.
            const message =
                messageOrError instanceof Error
                    ? String(
                          redactMaybeString(
                              readSafely(() => messageOrError.message).value,
                          ),
                      )
                    : redactSensitiveUrl(messageOrError)
            const contextText = this.stringifyContext(context)
            const combinedMessage = contextText
                ? `${message} | context: ${contextText}`
                : message

            const reportableError = new Error(combinedMessage)

            if (messageOrError instanceof Error) {
                reportableError.name = messageOrError.name
                reportableError.stack = redactMaybeString(
                    readSafely(() => messageOrError.stack).value,
                ) as typeof reportableError.stack

                // No groupingKey: this error's own stack points at where it was
                // thrown, which separates sites far better than a shared name
                // would. Supplying one here would prepend an identical frame
                // above genuinely distinct stacks and merge them.
                this.errorReporter({ severity, error: reportableError })
                return
            }

            // A string message means `reportableError`'s stack was captured
            // here, inside the logger — so it is identical for every such call
            // in the app, and a stack-fingerprinting reporter collapses them all
            // into one issue. Two things fix that:
            //
            // 1. `groupingKey`, the constant message, names the site. The
            //    message alone, never `combinedMessage`, whose interpolated
            //    context would make every event its own issue.
            // 2. Adopting the stack of an `Error` passed in context, so the
            //    frames below point at the real origin instead of at `log()`.
            const contextError = this.findContextError(context)
            // Read through readSafely: a throwing `stack` accessor here would
            // land in the outer catch and drop the whole report.
            const adoptedStack = readSafely(() => contextError?.stack).value
            if (adoptedStack) {
                reportableError.stack = redactMaybeString(
                    adoptedStack,
                ) as typeof reportableError.stack
            }

            this.errorReporter({
                severity,
                error: reportableError,
                groupingKey: message,
            })
        } catch {
            // Never allow error reporting to crash the app.
        }
    }

    /**
     * The `{ error }` convention most call sites already follow. `cause` and
     * `reason` cover the promise-rejection and settled-result spellings.
     * Deliberately shallow: a nested search would start adopting stacks from
     * incidental errors buried in a payload.
     */
    private findContextError(context?: LogContext): Optional<Error> {
        if (!context) return undefined
        for (const key of ['error', 'cause', 'reason']) {
            const value = (context as Record<string, unknown>)[key]
            if (value instanceof Error) return value
        }
        return undefined
    }

    /**
     * RN's LogBox intercepts `console.error` in dev, and with multiple
     * `ReactNativeHost`s registered it occasionally throws from inside
     * `LogBoxData.addLog` — masking the very error being logged. Wrapping keeps
     * `reportError` firing and falls back to `console.log`.
     */
    private safeConsoleError(message: string, args: unknown[]) {
        try {
            console.error(message, ...args)
        } catch {
            try {
                console.log(`[ERROR] ${message}`, ...args)
            } catch {
                // give up — never let logging crash the app.
            }
        }
    }

    private log(
        level: LogLevel,
        messageOrError: string | Error,
        context?: LogContext,
        reportAs?: LogErrorSeverity,
    ) {
        // Filter out logs below current level
        if (level < this.level) {
            return
        }

        const prefix = `[${LOG_LEVEL_NAMES[level]}]`
        const message =
            messageOrError instanceof Error
                ? messageOrError.message
                : messageOrError

        // A throwing getter (e.g. a native module's `code` accessor) must not
        // escape into the caller's error handler — this file's whole premise is
        // that logging never crashes the app.
        let args: LogContext[] = []
        if (context) {
            try {
                args = [this.formatContext(context)]
            } catch {
                args = [{ context: '[unformattable context]' }]
            }
        }

        switch (level) {
            case LogLevel.DEBUG:
            case LogLevel.INFO: {
                console.log(`${prefix} ${message}`, ...args)
                break
            }
            case LogLevel.WARN: {
                console.warn(`${prefix} ${message}`, ...args)
                // Only a downgraded error reports; a plain `warn` stays
                // console-only, so the breadcrumb trail reads as "errors we
                // chose not to report" rather than every warning in the app.
                if (reportAs) {
                    this.reportError(reportAs, messageOrError, context)
                }
                break
            }
            case LogLevel.ERROR: {
                this.safeConsoleError(`${prefix} ${message}`, args)
                this.reportError('error', messageOrError, context)
                break
            }
            case LogLevel.CRITICAL: {
                this.safeConsoleError(`${prefix} ${message}`, args)
                this.reportError('critical', messageOrError, context)
                break
            }
        }
    }
}

export const logger = new Logger()
