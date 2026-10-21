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
import {
    chainAccountOf,
    isMultisigAccount,
    multisigParametersOf,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import type {
    ChainId,
    ChainScope,
    WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useNetworkStore,
    useOnDeploymentSwitch,
    useWalletDeployment,
} from '@perawallet/wallet-core-chain-shared'
import {
    deviceIdForScope,
    useDeviceStore,
} from '@perawallet/wallet-core-device'
import { createMultisigAccount } from '@perawallet/wallet-core-multisig'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { useCapableChainIds } from '@hooks/useCapableChainIds'

type SyncTarget = { scope: ChainScope; deviceId: string }

/**
 * Re-registers every local multisig account on the new deployment's Pera
 * backend after a switch, on each chain with multisig. The backend is
 * per-deployment, so an account created on one 404s on the other;
 * `createMultisigAccount` is idempotent for a (deterministic) address, so
 * re-issuing it closes the gap. Best-effort: failures are logged, the next
 * switch retries. Ports Android's `SyncJointAccountsOnNetworkSwitchUseCase`.
 */
export const useSyncMultisigAccountsOnNetworkSwitch = (): void => {
    const deployment = useWalletDeployment()
    const chainIds = useCapableChainIds('multisig')
    // Primitive keys, so the effect below re-runs only when a multisig chain's
    // network or device id changes, never on unrelated store writes.
    const networksKey = useNetworkStore(state =>
        chainIds.map(chainId => selectChainNetworkId(state, chainId)).join(),
    )
    const scopes = useMemo(() => {
        const networkIds = networksKey.split(',')
        return chainIds.map((chainId: ChainId, index): ChainScope => ({
            chainId,
            networkId: networkIds[index] ?? '',
        }))
    }, [chainIds, networksKey])
    const deviceIdsKey = useDeviceStore(state =>
        scopes.map(scope => deviceIdForScope(state, scope) ?? '').join(),
    )
    const targets = useMemo(() => {
        const deviceIds = deviceIdsKey.split(',')
        return scopes.flatMap((scope, index): SyncTarget[] => {
            const deviceId = deviceIds[index]
            return deviceId ? [{ scope, deviceId }] : []
        })
    }, [scopes, deviceIdsKey])
    const accounts = useAllAccounts()

    // The accounts array gets a fresh reference on every store write (incl.
    // background sync ticks). Keep it in a ref so the sync effect can depend
    // solely on `deployment`/`targets` and not re-fire on every tick.
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
        // once a target's device id updates.
        if (pendingDeploymentRef.current !== deployment || targets.length === 0)
            return

        pendingDeploymentRef.current = null

        const jobs = targets.flatMap(({ scope, deviceId }) =>
            accountsRef.current.filter(isMultisigAccount).flatMap(account => {
                const parameters = multisigParametersOf(account, scope.chainId)
                return parameters
                    ? [{ account, parameters, scope, deviceId }]
                    : []
            }),
        )
        if (jobs.length === 0) return

        const run = async () => {
            const results = await Promise.allSettled(
                jobs.map(({ parameters, scope, deviceId }) =>
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
                    const { account, scope } = jobs[index]
                    logger.warn('Multisig network-switch sync failed', {
                        source: 'useSyncMultisigAccountsOnNetworkSwitch',
                        address: chainAccountOf(account, scope.chainId)
                            ?.address,
                        chainId: scope.chainId,
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
    }, [deployment, targets])
}
