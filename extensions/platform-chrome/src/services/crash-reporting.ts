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

/* oxlint-disable no-console -- the crash reporter the shared logger reports into; its pre-init fallback cannot route back through the logger */

import * as Sentry from '@sentry/browser'
import type { CrashReportingService } from '@perawallet/wallet-extension-platform'
import { config, isDebug } from '@perawallet/wallet-core-config'
import { toError } from '@perawallet/wallet-core-shared'

/**
 * Shapes that must never leave the device. Ordered most-specific first so a
 * mnemonic is redacted as one unit rather than word-by-word.
 */
const SECRET_PATTERNS: Array<{ re: RegExp; label: string }> = [
    // 12/25-word BIP39-style phrase. Deliberately loose on word count: any run
    // of 12+ lowercase words is treated as a phrase rather than prose, because
    // a false redaction costs nothing and a miss is unrecoverable.
    { re: /\b(?:[a-z]{3,8}\s+){11,}[a-z]{3,8}\b/g, label: '[redacted-phrase]' },
    // Base64/base64url blobs long enough to be a key, signature, or seed.
    { re: /\b[A-Za-z0-9+/_-]{40,}={0,2}\b/g, label: '[redacted-key]' },
    // Hex runs of 32 bytes or more.
    { re: /\b(?:0x)?[0-9a-fA-F]{64,}\b/g, label: '[redacted-hex]' },
]

const scrubString = (value: string): string =>
    SECRET_PATTERNS.reduce(
        (acc, { re, label }) => acc.replace(re, label),
        value,
    )

/**
 * Last line of defence before an event leaves the extension. Drops the
 * free-form containers Sentry would otherwise carry and redacts secret-shaped
 * text from the fields that remain.
 */
const scrubEvent = (event: Sentry.ErrorEvent): Sentry.ErrorEvent => {
    // `extra`/`contexts` are arbitrary caller-supplied payloads and
    // breadcrumbs replay recent activity — none is worth the exfiltration risk
    // in a wallet.
    delete event.extra
    delete event.contexts
    delete event.breadcrumbs
    delete event.request
    delete event.user

    if (event.message) event.message = scrubString(event.message)
    for (const exception of event.exception?.values ?? []) {
        if (exception.value) exception.value = scrubString(exception.value)
    }
    return event
}

// Error capture and grouping only. Everything else in Sentry's defaults
// records context we either strip in `scrubEvent` or never want sent.
const KEPT_INTEGRATIONS = new Set([
    'EventFilters',
    'FunctionToString',
    'GlobalHandlers',
    'LinkedErrors',
    'Dedupe',
    'BrowserSession',
])

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
            // Sentry's default integrations record console calls and fetch
            // traffic as breadcrumbs. In a wallet that is a standing risk:
            // nothing logs key material today, but one careless
            // `console.log(seed)` or a signing error whose message quotes its
            // payload would ship it to a third party. An allowlist, because a
            // denylist silently misses whatever a Sentry release adds or splits
            // out (v11 moved console capture into its own `Console` integration).
            integrations: integrations =>
                integrations.filter(integration =>
                    KEPT_INTEGRATIONS.has(integration.name),
                ),
            // Unset, v11 collects user info (and lets Sentry infer the client
            // IP), cookies, headers and bodies. Turn every category off.
            dataCollection: {
                userInfo: false,
                cookies: false,
                httpHeaders: false,
                httpBodies: [],
                urlQueryParams: false,
                graphQL: { document: false, variables: false },
                genAI: { inputs: false, outputs: false },
                databaseQueryData: false,
                queues: false,
                stackFrameVariables: false,
            },
            // Belt and braces for the payload that does get sent: drops the
            // request/user blocks outright and redacts anything mnemonic- or
            // key-shaped that reached an exception message.
            beforeSend: scrubEvent,
        })
        this.initialized = true
    }

    recordNonFatalError(error: unknown): void {
        if (!this.initialized) {
            console.error('[pera] non-fatal', error)
            return
        }
        Sentry.captureException(toError(error))
    }

    logBreadcrumb(_message: string): void {
        // Sentry breadcrumbs are not wired for this platform; the shared
        // classifier already keeps these errors out of the issue stream.
    }
}
