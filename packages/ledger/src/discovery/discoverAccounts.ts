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

import { discoverAccounts } from '@perawallet/wallet-core-hardware-wallet'
import type { LedgerAccount, LedgerTransport } from '../types'
import { MAX_ACCOUNT_SCAN_GAP } from '../constants'
import { classifyLedgerError } from '../errors'

export type DiscoverAccountsOptions = {
    /** The connected Ledger transport */
    transport: LedgerTransport

    /**
     * Check if an address has on-chain presence (funded, participated in transactions, etc).
     * If not provided, all discovered accounts are returned regardless of on-chain state.
     */
    isAccountOnChain?: (address: string) => Promise<boolean>

    /** Called after each account is fetched, for progress reporting */
    onProgress?: (accountIndex: number) => void
}

/**
 * Sequentially discovers Algorand accounts on a connected Ledger device.
 *
 * Fetches accounts at indices 0, 1, 2... and stops after
 * {@link MAX_ACCOUNT_SCAN_GAP} consecutive indices with no on-chain presence.
 * Index 0 is always included even if not funded (matches native app behavior).
 */
export const discoverLedgerAccounts = async (
    options: DiscoverAccountsOptions,
): Promise<LedgerAccount[]> => {
    return discoverAccounts({
        transport: options.transport,
        isAccountOnChain: options.isAccountOnChain,
        onProgress: options.onProgress,
        classifyError: classifyLedgerError,
        maxGap: MAX_ACCOUNT_SCAN_GAP,
    })
}
