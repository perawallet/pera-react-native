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

import { useCallback, useRef } from 'react'
import {
    isNotFoundError,
    isPeraNetworkError,
    type Network,
} from '@perawallet/wallet-core-shared'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { logEvent } from '@perawallet/wallet-core-analytics'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useCreateDeviceMutation } from './useCreateDeviceMutation'
import { useUpdateDeviceMutation } from './useUpdateDeviceMutation'
import { useDeviceID } from './useDeviceID'
import { usePushToken } from './usePushToken'
import { useDeviceStore } from '../store'
import { updateDevice as updateDeviceEndpoint } from './endpoints'

const DEVICE_ALREADY_EXISTS = 'device_already_exists'
const MIGRATED_DEVICE_ID_REPLACED_EVENT = 'migrated_device_id_replaced'

const shouldRecreateDevice = (error: unknown): boolean =>
    isNotFoundError(error) ||
    (isPeraNetworkError(error) && error.backendType === DEVICE_ALREADY_EXISTS)

export const useDevice = () => {
    const deviceIDs = useDeviceStore(state => state.deviceIDs)
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const { pushToken } = usePushToken()
    const setDeviceID = useDeviceStore(state => state.setDeviceID)
    const setDeviceIdOrigin = useDeviceStore(state => state.setDeviceIdOrigin)
    const deviceInfoService = getProvider().deviceInfo

    const { mutateAsync: createDevice } = useCreateDeviceMutation()
    const { mutateAsync: updateDevice } = useUpdateDeviceMutation()

    // Tracks the in-flight register attempt id. New calls bump it; callbacks
    // check their captured id before applying side-effects, so a stale
    // registration (e.g. fired right before a network switch) can't write
    // back the wrong network's deviceID.
    const inFlightIdRef = useRef(0)

    const buildPayload = useCallback(
        async (addresses: string[]) => ({
            accounts: addresses,
            platform: await deviceInfoService.getDevicePlatform(),
            push_token: pushToken ?? undefined,
            model: deviceInfoService.getDeviceModel(),
            locale: deviceInfoService.getDeviceLocale(),
            application: 'pera' as const,
        }),
        [deviceInfoService, pushToken],
    )

    const createDeviceForNetwork = useCallback(
        async (
            targetNetwork: Network,
            addresses: string[],
            attemptId: number,
        ) => {
            const payload = await buildPayload(addresses)
            const result = await createDevice({
                data: payload,
            })
            if (!result.id) {
                // Storing null would report this registration as healed
                // (createdNew fires mute replay) while
                // useIsDeviceRegistrationPending stays true forever. Fail the
                // attempt instead so the reconnect/foreground retry re-runs it.
                throw new Error('Device create response carried no id')
            }
            if (inFlightIdRef.current === attemptId) {
                setDeviceID(targetNetwork, result.id)
            }
        },
        [buildPayload, createDevice, setDeviceID],
    )

    // Single-attempt: ky already retries 5xx/network errors inside the shared
    // query-client, and a second loop here would compound to 6 requests a call.
    //
    // `createdNew` tells callers a fresh device row was minted, so they can
    // replay locally-migrated mute preferences — the backend defaults a new row
    // to "notifying".
    //
    // The createDevice fallback is application logic, not transport: it fires
    // when the server no longer recognizes this device, either a 404 on the PUT
    // (stale id after an env reset or deletion) or a `device_already_exists`
    // response (the row exists but isn't addressable by this id).
    const registerDevice = useCallback(
        async (addresses: string[]): Promise<{ createdNew: boolean }> => {
            const attemptId = ++inFlightIdRef.current
            const targetNetwork = network

            if (!deviceId) {
                await createDeviceForNetwork(
                    targetNetwork,
                    addresses,
                    attemptId,
                )
                return { createdNew: true }
            }

            try {
                const payload = await buildPayload(addresses)
                await updateDevice({
                    deviceId,
                    data: { ...payload, id: deviceId },
                })
                return { createdNew: false }
            } catch (error) {
                if (!shouldRecreateDevice(error)) throw error
                // Read live from the store rather than a subscribed snapshot:
                // the origin is only needed at recreate time, and subscribing
                // would rebuild this callback on every unrelated origin flip.
                const isReplacingMigratedId =
                    useDeviceStore.getState().deviceIdOrigins[targetNetwork] ===
                    'migrated'
                await createDeviceForNetwork(
                    targetNetwork,
                    addresses,
                    attemptId,
                )
                // Replacing a migrated id orphans its device-keyed server
                // state (Discover favorites, price alerts, banner
                // dismissals) — no reconciliation endpoint exists yet
                // (PERA-4670), so the loss is only made observable here.
                if (
                    isReplacingMigratedId &&
                    inFlightIdRef.current === attemptId
                ) {
                    setDeviceIdOrigin(targetNetwork, 'recreated')
                    logEvent(MIGRATED_DEVICE_ID_REPLACED_EVENT, {
                        network: targetNetwork,
                        reason: isNotFoundError(error)
                            ? 'not_found'
                            : DEVICE_ALREADY_EXISTS,
                    })
                }
                return { createdNew: true }
            }
        },
        [
            deviceId,
            network,
            buildPayload,
            updateDevice,
            createDeviceForNetwork,
            setDeviceIdOrigin,
        ],
    )

    /**
     * Detach the push token from the device record on a specific network so
     * the server stops pushing to a node we've moved away from. Best-effort:
     * any failure is swallowed (incl. 404 when the device was already deleted
     * server-side). Mirrors Android's `deletePreviousNodePushToken` in
     * `FirebaseTokenManager` — full PUT body with `push_token: ''` (Android's
     * `pushToken.orEmpty()`), routed via the raw endpoint so we hit the
     * *target* network's URL rather than `useNetwork()`'s current value
     * (which has already advanced to the new network by the time this fires).
     *
     * `accounts` is sent as `[]` so the PUT can't accidentally overwrite the
     * old network's account list with the new network's addresses. The
     * `accounts` field is required by the request schema, but we no longer
     * own that device for this network — leaving it empty is the safe value.
     */
    const clearDevicePushToken = useCallback(
        async (targetNetwork: Network) => {
            const targetDeviceId = deviceIDs?.get(targetNetwork)
            if (!targetDeviceId) return
            try {
                const payload = await buildPayload([])
                await updateDeviceEndpoint(targetNetwork, targetDeviceId, {
                    ...payload,
                    push_token: '',
                })
            } catch {
                // best-effort
            }
        },
        [deviceIDs, buildPayload],
    )

    return {
        deviceIDs,
        setDeviceID,
        registerDevice,
        clearDevicePushToken,
    }
}
