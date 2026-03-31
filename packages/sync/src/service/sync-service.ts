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
import { logger, type Network } from '@perawallet/wallet-core-shared'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import type { SyncServiceDeps } from '../models'

const POLL_INTERVAL = 3000

export class SyncService {
    private timer: ReturnType<typeof setTimeout> | null = null
    private running = false
    private hasCompletedInitialSync = false

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
        } catch (error) {
            logger.warn('Sync tick failed', { error })
        } finally {
            this.scheduleNextTick()
        }
    }

    private scheduleNextTick(): void {
        if (!this.running) return
        this.timer = setTimeout(() => void this.tick(), POLL_INTERVAL)
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

        for (const network of networks) {
            // 1. Sync all accounts in parallel (each failure isolated)
            await Promise.allSettled(
                accounts.map(a => fetchAndPersistAccount(a.address, network)),
            )

            // 2. Collect all unique asset IDs from DB holdings
            const assetIds = await getAllAssetIdsForNetwork({ network })

            // 3. Sync asset metadata and prices in parallel
            // Prices are always fetched from mainnet (inside fetchAndPersistPrices)
            // but stored under the active network so DB JOINs work correctly
            await Promise.allSettled([
                fetchAndPersistAssets(assetIds, network),
                fetchAndPersistPrices(assetIds, network),
            ])

            // 4. Sync recent transactions for each account
            await Promise.allSettled(
                accounts.map(a =>
                    fetchAndPersistTransactions(a.address, network),
                ),
            )
        }
    }

    invalidateQueries(): void {
        invalidateAccountQueries(this.deps.queryClient)
        invalidateAssetQueries(this.deps.queryClient)
        invalidateTransactionQueries(this.deps.queryClient)
    }
}
