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

import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { type Nullable } from '@perawallet/wallet-core-shared'
import { useAccountsStore } from '../store'
import { syncAndEnrichNewAccount } from '../sync/account-syncer'

/**
 * Watches the wallet's account set and runs a targeted sync + asset/price
 * enrichment for every address added during the session — import, create,
 * watch, HD discovery — so a new account shows real balances within seconds
 * instead of waiting on the gated background poll (which never refreshes an
 * account whose activity predates the should-refresh checkpoint).
 *
 * Mount once near the app root. The accounts present at first render are
 * left to the sync service's initial full pass.
 *
 * `isEnabled` gates the sync. During legacy→RN migration it must stay false
 * until the migrated device id is written: enriching an account before the
 * device id lands fetches assets over the unscoped endpoint and caches
 * `is_favorited: false` under the asset TTL, so migrated favorites never
 * reappear. While disabled the baseline is left unset so the
 * first enabled run re-establishes it without syncing.
 */
type UseSyncNewAccountsOptions = {
    isEnabled?: boolean
}

export const useSyncNewAccounts = ({
    isEnabled = true,
}: UseSyncNewAccountsOptions = {}): void => {
    const queryClient = useQueryClient()
    const { network } = useNetwork()
    const accounts = useAccountsStore(state => state.accounts)

    // The store array gets a new reference on every write (including each
    // background sync tick), so key the effect on the joined address set —
    // it only fires when membership actually changes.
    const addressesKey = useMemo(
        () => accounts.map(account => account.address).join('\n'),
        [accounts],
    )

    const knownAddresses = useRef<Nullable<Set<string>>>(null)

    useEffect(() => {
        if (!isEnabled) return

        const addresses = addressesKey ? addressesKey.split('\n') : []
        const known = knownAddresses.current

        // First run: record the baseline without syncing — startup accounts
        // are covered by the sync service's initial force-sync.
        if (known === null) {
            knownAddresses.current = new Set(addresses)
            return
        }

        const added = addresses.filter(address => !known.has(address))
        // Rebuild (rather than accumulate) so an address that is removed and
        // later re-imported counts as new again.
        knownAddresses.current = new Set(addresses)

        added.forEach(address => {
            void syncAndEnrichNewAccount(address, network, queryClient)
        })
    }, [isEnabled, addressesKey, network, queryClient])
}
