/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    addSslPinningErrorListener,
    initializeSslPinning,
    isSslPinningAvailable,
} from 'react-native-ssl-public-key-pinning'
import { RemoteConfigKeys } from '@perawallet/wallet-extension-platform'
import type {
    AnalyticsService,
    CrashReportingService,
    RemoteConfigService,
} from '@perawallet/wallet-extension-platform'
import { config } from '@perawallet/wallet-core-config'
import { buildPinningConfig } from './buildPinningConfig'

export type SslPinningDependencies = {
    remoteConfig: Pick<RemoteConfigService, 'getBooleanValue'>
    analytics: Pick<AnalyticsService, 'logEvent'>
    crashReporting: Pick<CrashReportingService, 'recordNonFatalError'>
    /** Overridable for tests; defaults to the build's configured backend URLs. */
    backendUrls?: readonly string[]
}

/**
 * Enables SSL public-key pinning for the Pera backend hosts, gated on the
 * `enable_ssl_pinning` remote-config flag.
 *
 * Call AFTER remote config has initialized: the flag decision must see the
 * freshest activated value, and because `getBooleanValue` only trusts
 * genuinely fetched values, pinning stays off until Firebase has delivered an
 * explicit `true` at least once. Firebase's own hosts are never pinned, so
 * flipping the flag off in the console remains reachable even when the pin
 * set itself is broken — that is the remote kill switch.
 *
 * Requests issued before this runs are unpinned (fail-open at cold start);
 * pinning is hardening, so setup errors are swallowed and reported rather
 * than allowed to break startup.
 */
export const initializeSslPinningService = async (
    dependencies: SslPinningDependencies,
): Promise<void> => {
    const {
        remoteConfig,
        analytics,
        crashReporting,
        backendUrls = [config.mainnetBackendUrl, config.testnetBackendUrl],
    } = dependencies

    try {
        const isEnabled = remoteConfig.getBooleanValue(
            RemoteConfigKeys.enable_ssl_pinning,
            false,
        )
        if (!isEnabled || !isSslPinningAvailable()) {
            return
        }

        const pinningConfig = buildPinningConfig(backendUrls)
        if (!pinningConfig) {
            return
        }

        addSslPinningErrorListener(({ serverHostname }) => {
            analytics.logEvent('ssl_pinning_failure', {
                server_hostname: serverHostname,
            })
            crashReporting.recordNonFatalError(
                new Error(
                    `SSL pinning validation failed for ${serverHostname}`,
                ),
            )
        })

        await initializeSslPinning(pinningConfig)
    } catch (error) {
        crashReporting.recordNonFatalError(error)
    }
}
