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
    HardwareWalletDerivedAccount,
    HardwareWalletTransport,
} from './types'
import { DEFAULT_MAX_ACCOUNT_SCAN_GAP } from './constants'

export type DiscoverAccountsOptions = {
    /** The connected hardware wallet transport */
    transport: HardwareWalletTransport

    /**
     * Check if an address has on-chain presence (funded, participated in transactions, etc).
     * If not provided, all discovered accounts are returned regardless of on-chain state.
     */
    isAccountOnChain?: (address: string) => Promise<boolean>

    /** Called after each account is fetched, for progress reporting */
    onProgress?: (accountIndex: number) => void

    /**
     * Classify raw errors from the transport into typed error classes.
     * If not provided, errors are rethrown as-is.
     */
    classifyError?: (error: unknown) => Error

    /**
     * Stop scanning after this many consecutive indices with no on-chain presence.
     * Defaults to {@link DEFAULT_MAX_ACCOUNT_SCAN_GAP}.
     */
    maxGap?: number
}

/**
 * Sequentially discovers Algorand accounts on a connected hardware wallet device.
 *
 * When `isAccountOnChain` is provided, fetches accounts at indices 0, 1, 2...
 * and stops after `maxGap` consecutive indices with no on-chain presence.
 * Index 0 is always included even if not funded.
 *
 * When `isAccountOnChain` is not provided, returns accounts at indices 0
 * through `maxGap` (inclusive) since on-chain presence cannot be determined.
 */
export const discoverAccounts = async (
    options: DiscoverAccountsOptions,
): Promise<HardwareWalletDerivedAccount[]> => {
    const {
        transport,
        isAccountOnChain,
        onProgress,
        classifyError,
        maxGap = DEFAULT_MAX_ACCOUNT_SCAN_GAP,
    } = options
    const accounts: HardwareWalletDerivedAccount[] = []
    let consecutiveEmpty = 0
    let index = 0

    while (consecutiveEmpty < maxGap) {
        let account: HardwareWalletDerivedAccount
        try {
            account = await transport.getAddress(index, false)
        } catch (error) {
            throw classifyError ? classifyError(error) : error
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
            if (index >= maxGap) {
                break
            }
        }

        index++
    }

    return accounts
}
