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

import type { CrashReportingService } from './models'

type LogSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical'

export type ErrorReportPayload = {
    severity: LogSeverity
    error: unknown
    /**
     * Names the logical error site when `error`'s own stack can't distinguish
     * it — see the logger's `reportError`, which synthesizes an `Error` whose
     * stack points at the logger rather than the caller.
     */
    groupingKey?: string
}

type CrashReportingAdapter = Partial<CrashReportingService> & {
    recordError?: (error: unknown) => void
}

const isReportableSeverity = (
    severity: LogSeverity,
): severity is 'error' | 'critical' =>
    severity === 'error' || severity === 'critical'

export const createCrashReportingErrorReporter = (
    crashReporting?: CrashReportingAdapter | null,
) => {
    return ({ severity, error, groupingKey }: ErrorReportPayload) => {
        if (!isReportableSeverity(severity)) {
            return
        }

        try {
            if (typeof crashReporting?.recordNonFatalError === 'function') {
                crashReporting.recordNonFatalError(error, groupingKey)

                return
            }

            if (typeof crashReporting?.recordError === 'function') {
                crashReporting.recordError(error)
            }
        } catch {
            // Never allow crash reporting failures to crash app startup.
        }
    }
}
