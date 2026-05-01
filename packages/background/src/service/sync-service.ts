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
    useAccountsStore,
    getAllAssetIdsForNetwork,
    invalidateAccountQueries,
    fetchAndPersistAccount,
} from '@perawallet/wallet-core-accounts'
import {
    sendShouldRefreshRequest,
    usePollingStore,
} from '@perawallet/wallet-core-polling'
import {
    invalidateAssetQueries,
    fetchAndPersistAssets,
    fetchAndPersistPrices,
} from '@perawallet/wallet-core-assets'
import {
    invalidateTransactionQueries,
    fetchAndPersistTransactions,
} from '@perawallet/wallet-core-transactions'
import {
    logger,
    calculateBackoff,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import type { SyncServiceDeps } from '../models'

const POLL_INTERVAL = 3000
const MAX_BACKOFF_INTERVAL = 30000
const BACKOFF_MULTIPLIER = 2

export class SyncService {
    private timer: Nullable<ReturnType<typeof setTimeout>> = null
    private running = false
    private hasCompletedInitialSync = false
    private currentInterval = POLL_INTERVAL

    constructor(private readonly deps: SyncServiceDeps) {}

    start(): void {
        if (this.running) return
        this.running = true
        void this.tick()
    }

    stop(): void {
        this.running = false
        if (this.timer !== null) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }

    restart(): void {
        this.stop()
        this.hasCompletedInitialSync = false
        this.currentInterval = POLL_INTERVAL
        this.start()
    }

    isRunning(): boolean {
        return this.running
    }

    private async tick(): Promise<void> {
        try {
            const activeNetwork = useNetworkStore.getState().network
            let networksToSync: Network[]

            if (!this.hasCompletedInitialSync) {
                // First tick: force-sync the active network to ensure DB is populated
                networksToSync = [activeNetwork]
                this.hasCompletedInitialSync = true
            } else {
                networksToSync = await this.checkShouldRefresh(activeNetwork)
            }

            if (networksToSync.length > 0) {
                await this.syncAll(networksToSync)
                this.invalidateQueries()
            }

            // Reset interval on success
            this.currentInterval = POLL_INTERVAL
        } catch (error) {
            logger.warn('Sync tick failed', { error })
            // Back off on errors to avoid hammering a rate-limited API
            this.currentInterval = calculateBackoff(
                this.currentInterval,
                BACKOFF_MULTIPLIER,
                MAX_BACKOFF_INTERVAL,
            )
        } finally {
            this.scheduleNextTick()
        }
    }

    private scheduleNextTick(): void {
        if (!this.running) return
        this.timer = setTimeout(() => void this.tick(), this.currentInterval)
    }

    private async checkShouldRefresh(
        activeNetwork: Network,
    ): Promise<Network[]> {
        const accounts = useAccountsStore.getState().accounts
        const addresses = accounts.map(a => a.address)

        if (addresses.length === 0) return []

        const { lastRefreshedRound, setLastRefreshedRound } =
            usePollingStore.getState()

        const neverSynced = lastRefreshedRound[activeNetwork] === null

        try {
            const result = await sendShouldRefreshRequest(
                activeNetwork,
                addresses,
                lastRefreshedRound[activeNetwork],
            )

            if (result.refresh || neverSynced) {
                setLastRefreshedRound(activeNetwork, result.round ?? null)
                return [activeNetwork]
            }
        } catch {
            if (neverSynced) {
                return [activeNetwork]
            }
        }

        return []
    }

    private async syncAll(networks: Network[]): Promise<void> {
        const accounts = useAccountsStore.getState().accounts
        let hasRateLimitError = false

        for (const network of networks) {
            // 1. Sync all accounts in parallel (each failure isolated)
            const accountResults = await Promise.allSettled(
                accounts.map(a => fetchAndPersistAccount(a.address, network)),
            )
            this.logFailures(
                'account',
                accountResults,
                network,
                i => accounts[i]?.address,
            )
            if (this.hasRateLimitFailure(accountResults)) {
                hasRateLimitError = true
            }

            // 2. Collect all unique asset IDs from DB holdings
            const assetIds = await getAllAssetIdsForNetwork({ network })

            // 3. Sync asset metadata and prices in parallel
            // Prices are always fetched from mainnet (inside fetchAndPersistPrices)
            // but stored under the active network so DB JOINs work correctly
            const assetResults = await Promise.allSettled([
                fetchAndPersistAssets(assetIds, network),
                fetchAndPersistPrices(assetIds, network),
            ])
            this.logFailures(
                'asset-metadata-or-prices',
                assetResults,
                network,
                i => (i === 0 ? 'assets' : 'prices'),
            )
            if (this.hasRateLimitFailure(assetResults)) {
                hasRateLimitError = true
            }

            // 4. Sync recent transactions for each account
            const txResults = await Promise.allSettled(
                accounts.map(a =>
                    fetchAndPersistTransactions(a.address, network),
                ),
            )
            this.logFailures(
                'transactions',
                txResults,
                network,
                i => accounts[i]?.address,
            )
            if (this.hasRateLimitFailure(txResults)) {
                hasRateLimitError = true
            }
        }

        if (hasRateLimitError) {
            throw new Error('Rate limited by API')
        }
    }

    private logFailures(
        phase: string,
        results: PromiseSettledResult<unknown>[],
        network: Network,
        subject: (index: number) => string | undefined,
    ): void {
        results.forEach((result, index) => {
            if (result.status !== 'rejected') return
            // Rate limits are handled separately via backoff — skip noise.
            if (
                result.reason instanceof Error &&
                result.reason.message.includes('429')
            ) {
                return
            }
            logger.warn('Sync step failed', {
                phase,
                network,
                subject: subject(index),
                error:
                    result.reason instanceof Error
                        ? {
                              message: result.reason.message,
                              stack: result.reason.stack,
                          }
                        : result.reason,
            })
        })
    }

    private hasRateLimitFailure(
        results: PromiseSettledResult<unknown>[],
    ): boolean {
        return results.some(
            r =>
                r.status === 'rejected' &&
                r.reason instanceof Error &&
                r.reason.message.includes('429'),
        )
    }

    invalidateQueries(): void {
        invalidateAccountQueries(this.deps.queryClient)
        invalidateAssetQueries(this.deps.queryClient)
        invalidateTransactionQueries(this.deps.queryClient)
    }

    /**
     * Targeted refresh for a specific set of addresses on a specific network.
     * Pulls fresh account info and recent transactions for each address from
     * the indexer, persists to the local DB, and invalidates the related
     * query caches so observers re-read the new state.
     *
     * Used by post-submission auto-refresh paths (see
     * `submitAndAutoRefresh` in @perawallet/wallet-core-signing) to update
     * sender/receiver balances as soon as a transaction confirms, without
     * waiting for the next periodic tick. Failures are logged but never
     * thrown — the periodic tick is the safety net.
     */
    async refreshAccounts(
        addresses: string[],
        network: Network,
    ): Promise<void> {
        if (addresses.length === 0) return

        const accountResults = await Promise.allSettled(
            addresses.map(a => fetchAndPersistAccount(a, network)),
        )
        const txResults = await Promise.allSettled(
            addresses.map(a => fetchAndPersistTransactions(a, network)),
        )

        this.logFailures(
            'refresh-accounts',
            accountResults,
            network,
            i => addresses[i],
        )
        this.logFailures(
            'refresh-transactions',
            txResults,
            network,
            i => addresses[i],
        )

        invalidateAccountQueries(this.deps.queryClient)
        invalidateTransactionQueries(this.deps.queryClient)
    }
}
