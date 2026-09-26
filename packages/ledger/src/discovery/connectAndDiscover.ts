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

import type {
    LedgerAccount,
    LedgerTransport,
    LedgerTransportProvider,
} from '@perawallet/wallet-extension-ledger-shared'
import { discoverLedgerAccounts } from './discoverAccounts'
import { withLedgerConnectionTimeout } from './ledgerTimeouts'

export type ConnectAndDiscoverOptions = {
    /** The transport provider to use for connecting */
    provider: LedgerTransportProvider

    /** The BLE device ID to connect to */
    deviceId: string

    /** Called after each account is fetched, for progress reporting */
    onProgress?: (accountIndex: number) => void

    /** Check if an address has on-chain presence */
    isAccountOnChain?: (address: string) => Promise<boolean>
}

export type ConnectAndDiscoverResult = {
    transport: LedgerTransport
    accounts: LedgerAccount[]
}

/**
 * Connects to a Ledger device and discovers all Algorand accounts on it.
 *
 * This is the core orchestration function that combines connection and discovery
 * into a single operation. The caller owns the transport lifecycle only on
 * SUCCESS (disconnecting when done); on any failure before the handoff this
 * function releases the BLE link itself — the caller never saw the transport,
 * so its cleanup cannot run.
 */
export const connectAndDiscoverAccounts = async (
    options: ConnectAndDiscoverOptions,
): Promise<ConnectAndDiscoverResult> => {
    const connectPromise = options.provider.connect(options.deviceId)
    let transport: LedgerTransport
    try {
        transport = await withLedgerConnectionTimeout(
            connectPromise,
            'Connect to Ledger',
        )
    } catch (error) {
        // A transport resolving after the timeout would hold the BLE link
        // forever (battery drain, blocks Ledger Live) — release it late.
        connectPromise
            .then(t => t.disconnect().catch(() => undefined))
            .catch(() => undefined)
        throw error
    }

    try {
        const accounts = await discoverLedgerAccounts({
            transport,
            onProgress: options.onProgress,
            isAccountOnChain: options.isAccountOnChain,
        })
        return { transport, accounts }
    } catch (error) {
        await transport.disconnect().catch(() => undefined)
        throw error
    }
}
