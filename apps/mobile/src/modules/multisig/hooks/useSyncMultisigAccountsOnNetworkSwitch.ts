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

import { useEffect, useRef } from 'react'
import {
    AccountTypes,
    useAllAccounts,
    type MultiSigAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useNetwork,
    useOnNetworkSwitch,
} from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { createMultisigAccount } from '@perawallet/wallet-core-multisig'
import {
    logger,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'

/**
 * Re-registers every local multisig account on the new network's Pera backend
 * after a switch. The backend is per-network, so an account created on one
 * network 404s on the other; `createMultisigAccount` is idempotent for a
 * (deterministic) address, so re-issuing it closes the gap. Best-effort:
 * failures are logged, the next switch retries. Ports Android's
 * `SyncJointAccountsOnNetworkSwitchUseCase`.
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

    // Flag a pending sync on a real switch; the run waits for the new network's
    // device id, which `useSwitchNetwork` registers just before the switch.
    const pendingNetworkRef = useRef<Nullable<Network>>(null)
    useOnNetworkSwitch((_from, to) => {
        pendingNetworkRef.current = to
    })

    useEffect(() => {
        // Bail until the flagged switch's device id lands; this effect re-runs
        // once `deviceId` updates.
        if (pendingNetworkRef.current !== network || !deviceId) return

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
