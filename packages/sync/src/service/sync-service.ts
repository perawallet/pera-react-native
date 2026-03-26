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
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import {
    sendShouldRefreshRequest,
    usePollingStore,
} from '@perawallet/wallet-core-polling'
import { logger } from '@perawallet/wallet-core-shared'
import type { SyncServiceDeps } from '../models'
import { fetchAndPersistAccount } from './account-syncer'
import { fetchAndPersistAssets } from './asset-syncer'
import { fetchAndPersistPrices } from './price-syncer'
import { fetchAndPersistTransactions } from './transaction-syncer'

const POLL_INTERVAL = 3000

export class SyncService {
    private timer: ReturnType<typeof setTimeout> | null = null
    private running = false

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
            const shouldRefresh = await this.checkShouldRefresh()
            if (shouldRefresh) {
                await this.syncAll()
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

    private async checkShouldRefresh(): Promise<boolean> {
        const accounts = useAccountsStore.getState().accounts
        const addresses = accounts.map(a => a.address)

        if (addresses.length === 0) return false

        const network = useNetworkStore.getState().network
        const lastRefreshedRound = usePollingStore.getState().lastRefreshedRound

        const response = await sendShouldRefreshRequest(
            network,
            addresses,
            lastRefreshedRound,
        )

        if (response.refresh) {
            usePollingStore
                .getState()
                .setLastRefreshedRound(response.round ?? null)
        }

        return response.refresh
    }

    private async syncAll(): Promise<void> {
        const accounts = useAccountsStore.getState().accounts
        const network = useNetworkStore.getState().network

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
            accounts.map(a => fetchAndPersistTransactions(a.address, network)),
        )
    }

    private invalidateQueries(): void {
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
