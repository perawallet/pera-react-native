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

import { useEffect, useRef } from 'react'
import {
    AccountTypes,
    useAllAccounts,
    type MultiSigAccount,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { createMultisigAccount } from '@perawallet/wallet-core-multisig'
import {
    logger,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'

/**
 * Re-registers every local multisig account on the Pera backend of the
 * newly-selected network whenever the user switches networks.
 *
 * The Pera backend is per-network: a multisig account is only known to the
 * backend of whichever network was active when it was created, so co-signing
 * and sign-requests 404 on the other network. This hook closes that gap by
 * re-issuing `createMultisigAccount` for the new network on every switch —
 * the create endpoint is idempotent for a (deterministic) multisig address.
 *
 * Ports pera-android's `SyncJointAccountsOnNetworkSwitchUseCase`. It is
 * deliberately a plain, best-effort `useEffect` rather than a React Query
 * mutation — mirroring `useDeviceRegistration`, the established pattern for
 * network-switch-driven backend registration. Failures are logged, never
 * thrown; the next switch retries. Runs on network switch only, never on the
 * initial mount.
 */
export const useSyncMultisigAccountsOnNetworkSwitch = (): void => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const accounts = useAllAccounts()

    // The accounts array gets a fresh reference on every store write (incl.
    // background sync ticks). Keep it in a ref so the sync effect can depend
    // solely on `network`/`deviceId` and not re-fire on every tick.
    const accountsRef = useRef(accounts)
    useEffect(() => {
        accountsRef.current = accounts
    }, [accounts])

    const previousNetworkRef = useRef(network)
    const pendingNetworkRef = useRef<Nullable<Network>>(null)

    useEffect(() => {
        // Flag a sync only on a real network switch — not on the initial
        // mount (mirrors Android's `previousNode != null` gate).
        if (previousNetworkRef.current !== network) {
            previousNetworkRef.current = network
            pendingNetworkRef.current = network
        }

        if (pendingNetworkRef.current !== network) return

        // The new network's device must be registered first. `useSwitchNetwork`
        // registers it before `setNetwork`, so the id is normally ready here;
        // if not, bail — this effect re-runs once the id lands.
        if (!deviceId) return

        pendingNetworkRef.current = null

        const multisigAccounts = accountsRef.current.filter(
            (account): account is MultiSigAccount =>
                account.type === AccountTypes.multisig,
        )
        if (multisigAccounts.length === 0) return

        const run = async () => {
            const results = await Promise.allSettled(
                multisigAccounts.map(account =>
                    createMultisigAccount(network, {
                        version: account.multisigDetails.version,
                        threshold: account.multisigDetails.threshold,
                        participant_addresses:
                            account.multisigDetails.addresses,
                        device_id: deviceId,
                    }),
                ),
            )
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    logger.warn('Multisig network-switch sync failed', {
                        source: 'useSyncMultisigAccountsOnNetworkSwitch',
                        address: multisigAccounts[index].address,
                        network,
                        error: result.reason,
                    })
                }
            })
        }

        run().catch(error => {
            logger.warn('Multisig network-switch sync failed', {
                source: 'useSyncMultisigAccountsOnNetworkSwitch',
                error,
            })
        })
    }, [network, deviceId])
}
