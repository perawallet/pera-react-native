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
import { onlineManager, focusManager } from '@tanstack/react-query'
import {
    useNetwork,
    useOnNetworkSwitch,
} from '@perawallet/wallet-core-blockchain'
import { logger, type Network } from '@perawallet/wallet-core-shared'

import { useDevice } from './useDevice'
import { useDeviceStore } from '../store'
import type { DeviceAccountRegistration } from '../models'

export type UseDeviceRegistrationOptions = {
    /**
     * Invoked after a registration attempt whose `createdNew` is true — the
     * backend device record was created from scratch (no local id, or a
     * recreate fallback), rather than a clean PUT against an existing one.
     */
    onDeviceCreated?: (network: Network) => void
}

/**
 * Drives best-effort device registration off network and account changes.
 * Mirrors Android's `DeviceRegistrationUseCase`; failures are logged, never
 * thrown — but marked pending so the reconnect/foreground recovery below
 * heals them.
 */
export const useDeviceRegistration = (
    accounts: DeviceAccountRegistration[],
    options?: UseDeviceRegistrationOptions,
): void => {
    const { network } = useNetwork()
    const { registerDevice, clearDevicePushToken } = useDevice()
    const setRegistrationPending = useDeviceStore(
        state => state.setRegistrationPending,
    )
    const isRegistrationPending = useDeviceStore(state =>
        state.pendingRegistrationNetworks.includes(network),
    )

    // Kept live every render (not just in an effect) so the mount effect and
    // the retry closure below always call the latest callback without being
    // listed as an effect dependency — mirrors `retryArgsRef` further down.
    const optionsRef = useRef(options)
    optionsRef.current = options

    // Callers derive `accounts` from the accounts store array, which gets a
    // new reference on every store write (incl. background sync ticks). Key
    // the effect on a stable serialization so it only refires when something
    // the backend actually receives changed — one store write or a reorder
    // must not mean one device registration. Account *names* are deliberately
    // absent: v3 doesn't carry them, so renaming must not re-register.
    const accountsKey = accounts
        .map(
            account =>
                `${account.address}|${account.accountType}|${account.receiveNotifications ? '1' : '0'}`,
        )
        .sort()
        .join('\n')

    // The key is a digest, not a payload — keep the real array in a ref so
    // the effect and the retry closure both send the current registrations
    // without listing an unstable array in the dependency list.
    const accountsRef = useRef(accounts)
    accountsRef.current = accounts

    // Stop the server pushing to the network we just left.
    useOnNetworkSwitch(previousNetwork => {
        clearDevicePushToken(previousNetwork).catch(error => {
            logger.warn('Device push-token cleanup failed', {
                source: 'useDeviceRegistration',
                error,
            })
        })
    })

    // Single-flight guard shared by the mount registration and the recovery
    // retry below, so an edge firing mid-attempt can't stack a concurrent PUT.
    // The monotonic attempt token keeps a stale attempt (deps changed before
    // it settled) from flipping the pending flag or releasing the lock a
    // newer attempt now owns.
    const inFlightRef = useRef(false)
    const attemptIdRef = useRef(0)

    // (Re)register on mount, when the account set changes, and on the new
    // network after a switch.
    useEffect(() => {
        const attemptId = ++attemptIdRef.current
        const isCurrent = () => attemptIdRef.current === attemptId
        inFlightRef.current = true
        registerDevice(accountsRef.current)
            .then(result => {
                if (!isCurrent()) return
                setRegistrationPending(network, false)
                if (result.createdNew) {
                    optionsRef.current?.onDeviceCreated?.(network)
                }
            })
            .catch(error => {
                if (isCurrent()) setRegistrationPending(network, true)
                logger.warn('Device registration failed', {
                    source: 'useDeviceRegistration',
                    error,
                })
            })
            .finally(() => {
                if (isCurrent()) inFlightRef.current = false
            })
    }, [accountsKey, network, registerDevice, setRegistrationPending])

    // A failed registration used to stay silently unregistered (no push
    // notifications) until the account set or network changed. While one is
    // pending, retry on the reconnect and foreground edges with the same
    // list the mount path registers. The app wires these managers in
    // QueryProvider (AppState -> focusManager) and the network module
    // (connectivity -> onlineManager).
    const retryArgsRef = useRef({ registerDevice })
    retryArgsRef.current = { registerDevice }

    useEffect(() => {
        if (!isRegistrationPending) return

        const retry = () => {
            if (inFlightRef.current) return
            if (!onlineManager.isOnline()) return
            const attemptId = ++attemptIdRef.current
            const isCurrent = () => attemptIdRef.current === attemptId
            inFlightRef.current = true
            const current = retryArgsRef.current
            current
                .registerDevice(accountsRef.current)
                .then(result => {
                    if (!isCurrent()) return
                    setRegistrationPending(network, false)
                    if (result.createdNew) {
                        optionsRef.current?.onDeviceCreated?.(network)
                    }
                })
                .catch(error => {
                    logger.warn('Device registration retry failed', {
                        source: 'useDeviceRegistration',
                        error,
                    })
                })
                .finally(() => {
                    if (isCurrent()) inFlightRef.current = false
                })
        }

        const unsubscribeOnline = onlineManager.subscribe(isOnline => {
            if (isOnline) retry()
        })
        const unsubscribeFocus = focusManager.subscribe(isFocused => {
            if (isFocused) retry()
        })
        return () => {
            unsubscribeOnline()
            unsubscribeFocus()
        }
    }, [isRegistrationPending, network, setRegistrationPending])
}
