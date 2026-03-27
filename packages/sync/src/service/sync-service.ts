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
} from '@perawallet/wallet-core-accounts'
import {
    sendShouldRefreshRequest,
    usePollingStore,
} from '@perawallet/wallet-core-polling'
import { logger, Networks, type Network } from '@perawallet/wallet-core-shared'
import type { SyncServiceDeps } from '../models'
import { fetchAndPersistAccount } from './account-syncer'
import { fetchAndPersistAssets } from './asset-syncer'
import { fetchAndPersistPrices } from './price-syncer'
import { fetchAndPersistTransactions } from './transaction-syncer'

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

    isRunning(): boolean {
        return this.running
    }

    private async tick(): Promise<void> {
        try {
            let networksToSync: Network[]

            if (!this.hasCompletedInitialSync) {
                // First tick: force-sync all networks to ensure DB is populated
                // The persisted lastRefreshedRound may exist from a previous session
                // but the DB may not have data for all networks
                networksToSync = Object.values(Networks)
                this.hasCompletedInitialSync = true
            } else {
                networksToSync = await this.checkShouldRefresh()
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

    private async checkShouldRefresh(): Promise<Network[]> {
        const accounts = useAccountsStore.getState().accounts
        const addresses = accounts.map(a => a.address)

        if (addresses.length === 0) return []

        const { lastRefreshedRound, setLastRefreshedRound } =
            usePollingStore.getState()

        const allNetworks = Object.values(Networks)
        const networksToSync: Network[] = []

        const results = await Promise.allSettled(
            allNetworks.map(network =>
                sendShouldRefreshRequest(
                    network,
                    addresses,
                    lastRefreshedRound[network],
                ),
            ),
        )

        for (let i = 0; i < allNetworks.length; i++) {
            const network = allNetworks[i]
            const result = results[i]
            const neverSynced = lastRefreshedRound[network] === null

            if (result.status === 'fulfilled') {
                if (result.value.refresh || neverSynced) {
                    setLastRefreshedRound(network, result.value.round ?? null)
                    networksToSync.push(network)
                }
            } else if (neverSynced) {
                networksToSync.push(network)
            }
        }

        return networksToSync
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
        this.deps.queryClient.invalidateQueries({
            predicate: query => {
                const key = query.queryKey
                if (key.length < 2) return false

                const prefix = key.at(0)
                return (
                    prefix === 'accounts' ||
                    prefix === 'assets' ||
                    prefix === 'transactions'
                )
            },
        })
    }
}
