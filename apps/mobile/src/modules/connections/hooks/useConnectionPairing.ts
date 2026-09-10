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

import { useCallback } from 'react'
import {
    CONNECTION_LATE_PAIRING_GRACE_MS,
    pairConnection,
    useOptionalConnectionRegistry,
    type ConnectionPairingOptions,
    type ConnectionPairingResult,
} from '@perawallet/wallet-core-connections'
import { DeeplinkTimeoutError } from '@hooks/deeplink/handlers/timeout'

export type UseConnectionPairingResult = {
    /** Runs `pairConnection` with the app's timeout error and late-outcome grace. */
    pair: (
        uri: string,
        options?: ConnectionPairingOptions,
    ) => Promise<ConnectionPairingResult>
    /**
     * Log-safe identifiers for a pairing URI. Never the URI itself: its
     * `key=`/`symKey=` is the pairing secret and error-level log context
     * ships to the crash reporter. Empty when nothing claims the URI.
     */
    describeUri: (uri: string) => Record<string, string | null>
}

// The deeplink error sheet keys its "took too long" copy off this error's tag.
const pairTimeoutError = (operation: string, ms: number): Error =>
    new DeeplinkTimeoutError(operation, ms)

export const useConnectionPairing = (): UseConnectionPairingResult => {
    // Non-throwing: `useDeepLink` is rendered by onboarding screens above
    // `ConnectionsProvider`, which never pair.
    const registry = useOptionalConnectionRegistry()

    const describeUri = useCallback(
        (uri: string): Record<string, string | null> =>
            registry?.describeUri(uri) ?? {},
        [registry],
    )

    const pair = useCallback(
        (
            uri: string,
            options?: ConnectionPairingOptions,
        ): Promise<ConnectionPairingResult> => {
            if (!registry) {
                return Promise.resolve({
                    type: 'connect-failed',
                    error: new Error(
                        'Pairing was requested from outside ConnectionsProvider',
                    ),
                })
            }
            return pairConnection(registry, uri, {
                pairTimeoutError,
                watchLateOutcomeMs: CONNECTION_LATE_PAIRING_GRACE_MS,
                ...options,
            })
        },
        [registry],
    )

    return { pair, describeUri }
}
