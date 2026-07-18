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

import * as Sentry from '@sentry/browser'
import type { CrashReportingService } from '@perawallet/wallet-extension-platform'
import { config, isDebug } from '@perawallet/wallet-core-config'

/**
 * Firebase has no Crashlytics Web SDK, so crash/error reporting on the
 * extension goes through Sentry instead (plain fetch/sendBeacon transport —
 * no dynamically-injected remote script, so it stays MV3-compliant).
 */
export class ChromeCrashReportingService implements CrashReportingService {
    private initialized = false

    initializeCrashReporting(): void {
        // Mirrors extensions/platform-react-native's isDebug gate: collect
        // only from signed/staged builds, never a local dev bundle, so
        // dev-only noise (unresolved modules, hot-reload) doesn't drown
        // real crashes. Also no-ops until a Sentry project (sentryDsn)
        // exists.
        if (isDebug || !config.sentryDsn) {
            return
        }
        Sentry.init({
            dsn: config.sentryDsn,
            environment: config.appEnvironment,
            release: config.releaseTag || undefined,
        })
        this.initialized = true
    }

    recordNonFatalError(error: unknown): void {
        if (!this.initialized) {
            console.error('[pera] non-fatal', error)
            return
        }
        Sentry.captureException(
            error instanceof Error ? error : new Error(String(error)),
        )
    }
}
