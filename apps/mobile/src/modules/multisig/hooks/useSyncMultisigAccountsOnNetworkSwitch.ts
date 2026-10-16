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
    chainAccountOf,
    isMultisigAccount,
    multisigParametersOf,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import {
    useOnDeploymentSwitch,
    useSelectedScope,
    useWalletDeployment,
} from '@perawallet/wallet-core-chain-shared'
import { useScopedDeviceID } from '@perawallet/wallet-core-device'
import { createMultisigAccount } from '@perawallet/wallet-core-multisig'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'

/**
 * Re-registers every local multisig account on the new deployment's Pera
 * backend after a switch. The backend is per-deployment, so an account created
 * on one 404s on the other; `createMultisigAccount` is idempotent for a
 * (deterministic) address, so re-issuing it closes the gap. Best-effort:
 * failures are logged, the next switch retries. Ports Android's
 * `SyncJointAccountsOnNetworkSwitchUseCase`.
 */
export const useSyncMultisigAccountsOnNetworkSwitch = (): void => {
    const deployment = useWalletDeployment()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const deviceId = useScopedDeviceID(scope)
    const accounts = useAllAccounts()

    // The accounts array gets a fresh reference on every store write (incl.
    // background sync ticks). Keep it in a ref so the sync effect can depend
    // solely on `deployment`/`deviceId` and not re-fire on every tick.
    const accountsRef = useRef(accounts)
    useEffect(() => {
        accountsRef.current = accounts
    }, [accounts])

    // Flag a pending sync on a real switch; the run waits for the new
    // deployment's device id, which registration mints after the switch. A
    // scope with no Pera backend (BetaNet, custom) has none, so it waits for a
    // Pera-backed one.
    const pendingDeploymentRef = useRef<Nullable<WalletMode>>(null)
    useOnDeploymentSwitch((_from, to) => {
        pendingDeploymentRef.current = to
    })

    useEffect(() => {
        // Bail until the flagged switch's device id lands; this effect re-runs
        // once `deviceId` updates.
        if (pendingDeploymentRef.current !== deployment || !deviceId) return

        pendingDeploymentRef.current = null

        const multisigAccounts = accountsRef.current
            .filter(isMultisigAccount)
            .flatMap(account => {
                const parameters = multisigParametersOf(
                    account,
                    LEGACY_CHAIN_ID,
                )
                return parameters ? [{ account, parameters }] : []
            })
        if (multisigAccounts.length === 0) return

        const run = async () => {
            const results = await Promise.allSettled(
                multisigAccounts.map(({ parameters }) =>
                    createMultisigAccount(scope, {
                        version: parameters.version,
                        threshold: parameters.threshold,
                        participant_addresses: parameters.addresses,
                        device_id: deviceId,
                    }),
                ),
            )
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    logger.warn('Multisig network-switch sync failed', {
                        source: 'useSyncMultisigAccountsOnNetworkSwitch',
                        address: chainAccountOf(
                            multisigAccounts[index].account,
                            LEGACY_CHAIN_ID,
                        )?.address,
                        deployment,
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
    }, [deployment, scope, deviceId])
}
