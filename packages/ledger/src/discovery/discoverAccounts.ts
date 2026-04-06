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
    const { transport, isAccountOnChain, onProgress } = options
    const accounts: LedgerAccount[] = []
    let consecutiveEmpty = 0
    let index = 0

    while (consecutiveEmpty < MAX_ACCOUNT_SCAN_GAP) {
        let account: LedgerAccount
        try {
            account = await transport.getAddress(index, false)
        } catch (error) {
            throw classifyLedgerError(error)
        }

        onProgress?.(index)

        if (isAccountOnChain) {
            const exists = await isAccountOnChain(account.address)

            if (exists) {
                accounts.push(account)
                consecutiveEmpty = 0
            } else if (index === 0) {
                // Always include the first account even if not on-chain
                accounts.push(account)
                consecutiveEmpty++
            } else {
                consecutiveEmpty++
            }
        } else {
            // Without on-chain check, include all accounts
            accounts.push(account)
            // Stop after the gap limit since we can't determine presence
            if (index >= MAX_ACCOUNT_SCAN_GAP) {
                break
            }
        }

        index++
    }

    return accounts
}
