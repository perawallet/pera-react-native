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

import type { AnalyticsService } from '@perawallet/wallet-extension-platform'
import { config } from '@perawallet/wallet-core-config'
import { ensureDeviceID } from '../device-id'

const MEASUREMENT_PROTOCOL_URL = 'https://www.google-analytics.com/mp/collect'

/**
 * Sends events via GA4's Measurement Protocol (a plain HTTPS POST) instead of
 * the Firebase Analytics / gtag.js SDK: gtag.js dynamically injects a
 * <script> from googletagmanager.com, which is remote code execution and
 * violates Chrome's Manifest V3 Web Store policy. Measurement Protocol lands
 * in the same GA4 property mobile's Firebase Analytics SDK reports to.
 */
export class ChromeAnalyticsService implements AnalyticsService {
    private clientIdPromise: Promise<string> | null = null

    initializeAnalytics(): void {
        // No SDK/session to stand up — client_id is resolved lazily per
        // logEvent call from the same persisted device id deviceInfo uses.
    }

    logEvent(key: string, payload?: Record<string, unknown>): void {
        if (!config.firebaseMeasurementId || !config.gaMeasurementApiSecret) {
            return
        }
        void this.send(key, payload)
    }

    private async send(
        key: string,
        payload?: Record<string, unknown>,
    ): Promise<void> {
        try {
            this.clientIdPromise ??= ensureDeviceID()
            const clientId = await this.clientIdPromise

            const url = `${MEASUREMENT_PROTOCOL_URL}?measurement_id=${config.firebaseMeasurementId}&api_secret=${config.gaMeasurementApiSecret}`

            await fetch(url, {
                method: 'POST',
                body: JSON.stringify({
                    client_id: clientId,
                    events: [{ name: key, params: payload ?? {} }],
                }),
            })
        } catch {
            // Best-effort — analytics must never surface an error to the
            // caller (packages/analytics/src/log.ts already wraps every
            // call in its own try/catch, but this belt-and-braces guard
            // keeps the promise from producing an unhandled rejection).
        }
    }
}
