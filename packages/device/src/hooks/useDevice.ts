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
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useRegisterDeviceMutation } from './useRegisterDeviceMutation'
import { useDeviceID } from './useDeviceID'
import { usePushToken } from './usePushToken'
import { useDeviceStore } from '../store'
import { registerDevice as registerDeviceEndpoint } from './endpoints'
import type { DeviceAccountRegistration, DeviceRegistration } from '../models'

/**
 * v3 returns 404 when the id we hold is unknown — it never auto-creates. A
 * stale id (env reset, device deleted server-side) heals by registering again
 * without one.
 */
const shouldRecreateDevice = (error: unknown): boolean => isNotFoundError(error)

/**
 * v3 returns 400 when another device claimed this push token at the same
 * moment. The documented remedy is a retry, not a re-create: re-creating on
 * this race leaves a duplicate device row behind.
 */
const isPushTokenClaimedError = (error: unknown): boolean =>
    isPeraNetworkError(error) && error.status === 400

export const useDevice = () => {
    const deviceIDs = useDeviceStore(state => state.deviceIDs)
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const { pushToken } = usePushToken()
    const setDeviceID = useDeviceStore(state => state.setDeviceID)
    const deviceInfoService = getProvider().deviceInfo

    const { mutateAsync: register } = useRegisterDeviceMutation()

    // Tracks the in-flight register attempt id. New calls bump it; callbacks
    // check their captured id before applying side-effects, so a stale
    // registration (e.g. fired right before a network switch) can't write
    // back the wrong network's deviceID.
    const inFlightIdRef = useRef(0)

    // v3 requires push_token, locale and app_version on every call; there is
    // no "omit to keep the stored value" path. A null token becomes '' — see
    // the id rule on `registerDevice` for why that is safe.
    const buildPayload = useCallback(
        (accounts: DeviceAccountRegistration[]): DeviceRegistration => ({
            accounts,
            platform: deviceInfoService.getDevicePlatform(),
            pushToken: pushToken ?? '',
            locale: deviceInfoService.getDeviceLocale(),
            appVersion: deviceInfoService.getAppVersion(),
        }),
        [deviceInfoService, pushToken],
    )

    const createDeviceForNetwork = useCallback(
        async (
            targetNetwork: Network,
            accounts: DeviceAccountRegistration[],
            attemptId: number,
        ) => {
            const result = await register({ data: buildPayload(accounts) })
            if (!result.id) {
                // Storing null would report this registration as healed while
                // useIsDeviceRegistrationPending stays true forever. Fail the
                // attempt instead so the reconnect/foreground retry re-runs it.
                throw new Error('Device create response carried no id')
            }
            if (inFlightIdRef.current === attemptId) {
                setDeviceID(targetNetwork, result.id)
            }
        },
        [buildPayload, register, setDeviceID],
    )

    /**
     * Single-attempt registration. `createdNew` tells callers whether this
     * attempt created a fresh device record (no prior id, or a 404 recreate)
     * versus updating an existing one.
     *
     * **Once an id exists we always send it.** v3 mints a brand-new device for
     * every id-less call carrying an empty push token, so the only id-less
     * call is the first registration on a device whose FCM token hasn't
     * arrived (or was denied) — and the returned id is persisted immediately,
     * which bounds that to one.
     *
     * Transient retries (5xx, network errors) are handled by ky inside the
     * shared query-client; layering another retry loop here would compound to
     * up to 6 requests per call. The single 400 retry below is different in
     * kind: it is a documented v3 write race, not a transport failure.
     */
    const registerDevice = useCallback(
        async (
            accounts: DeviceAccountRegistration[],
        ): Promise<{ createdNew: boolean }> => {
            const attemptId = ++inFlightIdRef.current
            const targetNetwork = network

            if (!deviceId) {
                await createDeviceForNetwork(targetNetwork, accounts, attemptId)
                return { createdNew: true }
            }

            const payload = { ...buildPayload(accounts), id: deviceId }

            try {
                await register({ data: payload })
                return { createdNew: false }
            } catch (error) {
                if (isPushTokenClaimedError(error)) {
                    await register({ data: payload })
                    return { createdNew: false }
                }
                // Anything else that isn't a stale id — 422 validation, 401,
                // an unexpected 4xx — propagates untouched. Retrying a
                // malformed payload cannot fix it, and re-creating would hide
                // the bug behind a duplicate device.
                if (!shouldRecreateDevice(error)) throw error
                await createDeviceForNetwork(targetNetwork, accounts, attemptId)
                return { createdNew: true }
            }
        },
        [deviceId, network, buildPayload, register, createDeviceForNetwork],
    )

    /**
     * Detach the push token from the device record on a specific network so
     * the server stops pushing to a node we've moved away from. Best-effort:
     * any failure is swallowed (incl. 404 when the device was already deleted
     * server-side).
     *
     * Routed via the raw endpoint so we hit the *target* network's URL rather
     * than `useNetwork()`'s current value, which has already advanced by the
     * time this fires. Carrying `id` is what makes `pushToken: ''` clear that
     * device instead of minting a new one. `accounts` is `[]` so this can't
     * overwrite the old network's account list with the new network's.
     */
    const clearDevicePushToken = useCallback(
        async (targetNetwork: Network) => {
            const targetDeviceId = deviceIDs?.get(targetNetwork)
            if (!targetDeviceId) return
            try {
                await registerDeviceEndpoint(targetNetwork, {
                    ...buildPayload([]),
                    id: targetDeviceId,
                    pushToken: '',
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
