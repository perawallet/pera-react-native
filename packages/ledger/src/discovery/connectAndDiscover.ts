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

import type {
    LedgerAccount,
    LedgerTransport,
    LedgerTransportProvider,
} from '../types'
import { discoverLedgerAccounts } from './discoverAccounts'

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
 * into a single operation. The caller is responsible for managing the transport
 * lifecycle (disconnecting when done).
 */
export const connectAndDiscoverAccounts = async (
    options: ConnectAndDiscoverOptions,
): Promise<ConnectAndDiscoverResult> => {
    const transport = await options.provider.connect(options.deviceId)

    const accounts = await discoverLedgerAccounts({
        transport,
        onProgress: options.onProgress,
        isAccountOnChain: options.isAccountOnChain,
    })

    return { transport, accounts }
}
