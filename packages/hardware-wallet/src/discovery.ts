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

import { logger } from '@perawallet/wallet-core-shared'
import type {
    HardwareWalletDerivedAccount,
    HardwareWalletTransport,
} from './types'
import {
    DEFAULT_MAX_ACCOUNT_SCAN_GAP,
    DEFAULT_MAX_ACCOUNT_SCAN_INDEX,
    DEFAULT_ONCHAIN_ACCOUNT_SCAN_GAP,
} from './constants'

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
     * Stop scanning after this many consecutive indices with no on-chain
     * presence. Defaults to {@link DEFAULT_ONCHAIN_ACCOUNT_SCAN_GAP} when
     * `isAccountOnChain` is provided, {@link DEFAULT_MAX_ACCOUNT_SCAN_GAP}
     * otherwise.
     */
    maxGap?: number

    /**
     * Hard ceiling on the highest derivation index visited, no matter how
     * many funded accounts keep resetting the gap. Defaults to
     * {@link DEFAULT_MAX_ACCOUNT_SCAN_INDEX}.
     */
    maxIndex?: number
}

/**
 * Sequentially discovers Algorand accounts on a connected hardware wallet device.
 *
 * When `isAccountOnChain` is provided, fetches accounts at indices 0, 1, 2...
 * and stops after `maxGap` consecutive indices with no on-chain presence,
 * bounded by `maxIndex`. Index 0 is always included even if not funded. A
 * probe failure (offline, indexer down) degrades to the capped scan below
 * from the current index onward — never a discovery error, so offline
 * import keeps working.
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
        maxGap = isAccountOnChain
            ? DEFAULT_ONCHAIN_ACCOUNT_SCAN_GAP
            : DEFAULT_MAX_ACCOUNT_SCAN_GAP,
        maxIndex = DEFAULT_MAX_ACCOUNT_SCAN_INDEX,
    } = options
    const accounts: HardwareWalletDerivedAccount[] = []
    let consecutiveEmpty = 0
    let index = 0
    let probe = isAccountOnChain ?? null
    // Cap for the no-probe walk: the caller's gap when no probe was given
    // (original contract: indices 0..maxGap inclusive), the shallow default
    // when degrading from a dead probe mid-scan.
    const cappedCeiling = isAccountOnChain
        ? DEFAULT_MAX_ACCOUNT_SCAN_GAP
        : maxGap

    while (consecutiveEmpty < maxGap && index <= maxIndex) {
        let account: HardwareWalletDerivedAccount
        try {
            account = await transport.getAddress(index, false)
        } catch (error) {
            throw classifyError ? classifyError(error) : error
        }

        onProgress?.(index)

        if (probe) {
            let exists: boolean | null = null
            try {
                exists = await probe(account.address)
            } catch (error) {
                // Probe unavailable (offline, indexer down): degrade to the
                // capped no-probe behavior for the rest of the scan instead
                // of failing discovery — accounts already found are kept.
                // Logged so a broken probe in the field is diagnosable rather
                // than looking like a permanently shallow scan.
                logger.warn(
                    'On-chain probe failed; falling back to the capped scan',
                    { index, error },
                )
                probe = null
            }

            if (exists !== null) {
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
                index++
                continue
            }
        }

        // Without a (working) on-chain check, include all accounts and stop
        // at the capped ceiling since presence can't be determined.
        accounts.push(account)
        if (index >= cappedCeiling) {
            break
        }

        index++
    }

    return accounts
}
