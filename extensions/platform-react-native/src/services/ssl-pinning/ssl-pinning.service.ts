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
import type { PinningConfig } from './buildPinningConfig'

/** Domains eligible for pinning per group — never pin outside these. */
const BACKEND_PIN_DOMAINS = ['perawallet.app'] as const
const NODE_PIN_DOMAINS = ['algonode.cloud'] as const

export type SslPinningDependencies = {
    remoteConfig: Pick<RemoteConfigService, 'getBooleanValue'>
    analytics: Pick<AnalyticsService, 'logEvent'>
    crashReporting: Pick<CrashReportingService, 'recordNonFatalError'>
    /** Overridable for tests; defaults to the build's configured backend URLs. */
    backendUrls?: readonly string[]
    /** Overridable for tests; defaults to the build's algod/indexer URLs. */
    nodeUrls?: readonly string[]
}

/**
 * Enables SSL public-key pinning for two independently flagged host groups:
 * the Pera backend (`enable_ssl_pinning_pera_api`) and the Algorand node/indexer
 * providers (`enable_ssl_pinning_algod`). Separate flags = separate kill
 * switches: a CA surprise on one group can be disabled without dropping
 * protection on the other. Both groups share the same pin set — every host is
 * served through Cloudflare, whose partner-CA roots are what we pin.
 *
 * Call AFTER remote config has initialized: the flag decisions must see the
 * freshest activated values, and because `getBooleanValue` only trusts
 * genuinely fetched values, pinning stays off until Firebase has delivered an
 * explicit `true` at least once. Firebase's own hosts are never pinned, so
 * flipping a flag off in the console remains reachable even when the pin set
 * itself is broken.
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
        nodeUrls = [
            config.mainnetAlgodUrl,
            config.testnetAlgodUrl,
            config.mainnetIndexerUrl,
            config.testnetIndexerUrl,
        ],
    } = dependencies

    try {
        const groups = [
            {
                flag: RemoteConfigKeys.enable_ssl_pinning_pera_api,
                urls: backendUrls,
                domains: BACKEND_PIN_DOMAINS,
            },
            {
                flag: RemoteConfigKeys.enable_ssl_pinning_algod,
                urls: nodeUrls,
                domains: NODE_PIN_DOMAINS,
            },
        ]

        const pinningConfig: PinningConfig = {}
        for (const group of groups) {
            if (!remoteConfig.getBooleanValue(group.flag, false)) {
                continue
            }
            Object.assign(
                pinningConfig,
                buildPinningConfig(group.urls, group.domains),
            )
        }

        if (
            Object.keys(pinningConfig).length === 0 ||
            !isSslPinningAvailable()
        ) {
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
