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

import { useCallback, useRef } from 'react'
import { type Network } from '@perawallet/wallet-core-shared'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useCreateDeviceMutation } from './useCreateDeviceMutation'
import { useUpdateDeviceMutation } from './useUpdateDeviceMutation'
import { useDeviceID } from './useDeviceID'
import { usePushToken } from './usePushToken'
import { useDeviceStore } from '../store'
import { updateDevice as updateDeviceEndpoint } from './endpoints'

const REGISTER_DEVICE_MAX_RETRIES = 3
const REGISTER_DEVICE_RETRY_DELAY_MS = 1500

const sleep = (ms: number) =>
    new Promise<void>(resolve => setTimeout(resolve, ms))

const isNotFoundError = (error: unknown): boolean => {
    const status = (error as { response?: { status?: number } })?.response
        ?.status
    return status === 404
}

const isTransientError = (error: unknown): boolean => {
    const name = (error as { name?: string })?.name
    if (
        name === 'TimeoutError' ||
        name === 'AbortError' ||
        name === 'TypeError' // network unreachable
    ) {
        return true
    }
    const status = (error as { response?: { status?: number } })?.response
        ?.status
    return typeof status === 'number' && status >= 500
}

export const useDevice = () => {
    const deviceIDs = useDeviceStore(state => state.deviceIDs)
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const { pushToken } = usePushToken()
    const setDeviceID = useDeviceStore(state => state.setDeviceID)
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
                data: { ...payload, application: 'pera' },
            })
            if (inFlightIdRef.current === attemptId) {
                setDeviceID(targetNetwork, result.id ?? null)
            }
        },
        [buildPayload, createDevice, setDeviceID],
    )

    const registerDevice = useCallback(
        async (addresses: string[]) => {
            const attemptId = ++inFlightIdRef.current
            const targetNetwork = network

            for (
                let attempt = 0;
                attempt < REGISTER_DEVICE_MAX_RETRIES;
                attempt++
            ) {
                if (inFlightIdRef.current !== attemptId) return

                try {
                    if (!deviceId) {
                        await createDeviceForNetwork(
                            targetNetwork,
                            addresses,
                            attemptId,
                        )
                    } else {
                        try {
                            const payload = await buildPayload(addresses)
                            await updateDevice({
                                deviceId,
                                data: payload,
                            })
                        } catch (error) {
                            // Server doesn't know this device anymore
                            // (stale ID after env reset, deletion, etc.) —
                            // fall back to creating a fresh one. Mirrors
                            // Android's 404 → re-register handling.
                            if (isNotFoundError(error)) {
                                await createDeviceForNetwork(
                                    targetNetwork,
                                    addresses,
                                    attemptId,
                                )
                            } else {
                                throw error
                            }
                        }
                    }
                    return
                } catch (error) {
                    const isLastAttempt =
                        attempt === REGISTER_DEVICE_MAX_RETRIES - 1
                    if (isLastAttempt || !isTransientError(error)) {
                        throw error
                    }
                    await sleep(REGISTER_DEVICE_RETRY_DELAY_MS)
                }
            }
        },
        [deviceId, network, buildPayload, updateDevice, createDeviceForNetwork],
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
