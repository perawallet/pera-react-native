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
    getActiveConnectionRegistry,
    pairConnection,
    useOptionalConnectionRegistry,
    type ConnectionPairingOptions,
    type ConnectionPairingResult,
    type ConnectionRegistryClient,
} from '@perawallet/wallet-core-connections'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { DeeplinkTimeoutError } from '@modules/deeplink/handlers/timeout'

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
    const contextRegistry = useOptionalConnectionRegistry()

    // Every sheet's content is portaled to the sheet host, which mounts ABOVE
    // `ConnectionsProvider`, so the in-app browser bridge and the paste-link
    // sheet see no context and fall back to the same instance `useConnectionsBoot`
    // publishes. Resolved per call rather than per render: a pairing entry point
    // can render before the registry boots.
    const resolveRegistry = useCallback(
        (): Nullable<ConnectionRegistryClient> =>
            contextRegistry ?? getActiveConnectionRegistry(),
        [contextRegistry],
    )

    const describeUri = useCallback(
        (uri: string): Record<string, string | null> =>
            resolveRegistry()?.describeUri(uri) ?? {},
        [resolveRegistry],
    )

    const pair = useCallback(
        (
            uri: string,
            options?: ConnectionPairingOptions,
        ): Promise<ConnectionPairingResult> => {
            const registry = resolveRegistry()
            if (!registry) {
                return Promise.resolve({
                    type: 'connect-failed',
                    error: new Error(
                        'Pairing was requested before the connections registry was ready',
                    ),
                })
            }
            return pairConnection(registry, uri, {
                pairTimeoutError,
                watchLateOutcomeMs: CONNECTION_LATE_PAIRING_GRACE_MS,
                ...options,
            })
        },
        [resolveRegistry],
    )

    return { pair, describeUri }
}
