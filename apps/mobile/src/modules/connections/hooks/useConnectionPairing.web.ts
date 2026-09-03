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
import type { ConnectionPairingOutcome } from '@perawallet/wallet-core-connections'
// lanekeep-ignore-next-line pera/no-wc-imports-in-connections-module reason: the extension mounts no registry, so this twin is the composition root for the protocol on web
import { walletConnectLogContext } from '@perawallet/wallet-core-walletconnect'
import { useWalletConnectPairing } from '@modules/walletconnect/hooks/useWalletConnectPairing'
import type {
    ConnectionPairingOptions,
    ConnectionPairingResult,
    UseConnectionPairingResult,
} from './connectionPairingModel'

/**
 * Web twin. The browser extension mounts no `ConnectionsProvider`: offscreen
 * (`wcHost.ts`) owns every connector there, so pairing keeps going through
 * `useWalletConnectPairing`'s own `.web` twin and this only re-labels the
 * result into the shared shape.
 */
export const useConnectionPairing = (): UseConnectionPairingResult => {
    const { pair: pairLegacy } = useWalletConnectPairing()

    const pair = useCallback(
        async (
            uri: string,
            options?: ConnectionPairingOptions,
        ): Promise<ConnectionPairingResult> => {
            const result = await pairLegacy(uri, options)
            if (result.type === 'timeout') {
                // Offscreen owns the connector, so there is no id to hand
                // back and no late watch is possible here.
                return { type: 'timeout' }
            }
            return result
        },
        [pairLegacy],
    )

    const watchLateOutcome = useCallback(
        async (): Promise<ConnectionPairingOutcome> => ({ type: 'timeout' }),
        [],
    )

    const describeUri = useCallback(
        (uri: string): Record<string, string | null> =>
            walletConnectLogContext(uri),
        [],
    )

    return { pair, watchLateOutcome, describeUri }
}

/** Parity with the native module; nothing is memoised across calls here. */
export const resetConnectionPairingStateForTesting = (): void => {}
