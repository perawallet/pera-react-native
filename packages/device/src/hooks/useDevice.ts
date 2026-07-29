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

import { useCallback } from 'react'
import {
    isNotFoundError,
    isPeraNetworkError,
    type Network,
} from '@perawallet/wallet-core-shared'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useRegisterDeviceMutation } from './useRegisterDeviceMutation'
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

type RegisterDeviceResult = { createdNew: boolean }

// Module scope, deliberately NOT a `useRef`: every `useDevice()` call site —
// the mount-time registration, a notification-preference toggle mounted from
// a completely different screen, any future caller — must share ONE lock per
// network. A per-hook-instance lock only serializes calls made through that
// same mounted instance; two different components calling `registerDevice`
// concurrently would each get their own empty map and still fire two
// independent id-less POSTs, minting two device rows. See
// `acquireCreatedDeviceId`.
const pendingDeviceCreates = new Map<Network, Promise<string>>()

/**
 * Tests only — never call from production code. The map above is module
 * state, so without this a leaked in-flight entry from one test silently
 * wedges an unrelated test later in the same file.
 */
export const clearPendingDeviceCreatesForTests = (): void => {
    pendingDeviceCreates.clear()
}

// Module scope, serializing EVERY `registerDevice` call for a network — not
// just id-less creates. `pendingDeviceCreates` above only ever protects the
// *first* registration; once an id exists (the steady state for every real
// toggle) `registerDevice` goes straight to `registerWithId`, which has no
// serialization of its own. `registerDevice` has more than one caller per
// mounted app — the account/network-driven registrar in
// `useDeviceRegistration` and, since PERA-4705's notification-toggle
// rewrite, `useAccountNotificationToggle` — and both can hold the id
// already. Toggling a preference writes the local store optimistically,
// which changes `useDeviceRegistration`'s `accountsKey` and refires its own
// `registerDevice` call concurrently with the toggle's; if the toggle's own
// call then fails, its rollback fires a third, corrective call. Without a
// queue spanning the whole registration (not just the id-less path), that
// corrective call can lose a race against the second (stale, pre-rollback)
// one still in flight, leaving the server on a flag the persisted local
// store no longer holds. Chaining every call through one promise per
// network instead guarantees strict arrival order, so the corrective call
// always resolves last.
const registrationQueues = new Map<Network, Promise<void>>()

/**
 * Tests only — never call from production code. The map above is module
 * state, so without this a leaked, never-settled entry from one test (e.g.
 * one that fails before resolving its own mocked in-flight promise) silently
 * wedges every later test in the same file that registers on the same
 * network.
 */
export const clearRegistrationQueuesForTests = (): void => {
    registrationQueues.clear()
}

const enqueueRegistration = (
    targetNetwork: Network,
    task: () => Promise<RegisterDeviceResult>,
): Promise<RegisterDeviceResult> => {
    const previous = registrationQueues.get(targetNetwork)
    // Run synchronously (no queue in front of it) when nothing is pending —
    // matches the pre-existing behaviour callers rely on, where the create
    // POST fires within the same tick as the call rather than one microtask
    // later. Only an actual pending predecessor defers this call.
    const result = previous ? previous.then(task) : task()
    // Always-resolving tail: one call's rejection must not wedge every
    // later call for this network behind a promise that will never settle.
    registrationQueues.set(
        targetNetwork,
        result.then(
            () => undefined,
            () => undefined,
        ),
    )
    return result
}

export const useDevice = () => {
    const deviceIDs = useDeviceStore(state => state.deviceIDs)
    const { network } = useNetwork()
    const { pushToken } = usePushToken()
    const setDeviceID = useDeviceStore(state => state.setDeviceID)
    const deviceInfoService = getProvider().deviceInfo

    const { mutateAsync: register } = useRegisterDeviceMutation()

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

    // The one place that ever issues an id-less POST. Persists the id it
    // gets back immediately: `acquireCreatedDeviceId` guarantees only one of
    // these can be in flight per network at a time, so there is never a
    // second, independent create for the same network to race against — a
    // late-arriving write here can only ever land in its own, still-current
    // slot.
    const createDeviceForNetwork = useCallback(
        async (
            targetNetwork: Network,
            accounts: DeviceAccountRegistration[],
        ): Promise<string> => {
            const result = await register({ data: buildPayload(accounts) })
            if (!result.id) {
                // Storing null would report this registration as healed while
                // useIsDeviceRegistrationPending stays true forever. Fail the
                // attempt instead so the reconnect/foreground retry re-runs it.
                throw new Error('Device create response carried no id')
            }
            setDeviceID(targetNetwork, result.id)
            return result.id
        },
        [buildPayload, register, setDeviceID],
    )

    /**
     * Serializes id-less creates for a given network *across every mounted
     * `useDevice()` consumer* — the lock (`pendingDeviceCreates`, above) is
     * module scope, not per-instance. If a create is already in flight for
     * this network, this call joins it instead of firing a second POST — so
     * concurrent callers from different components (e.g. the mount-time
     * registration and a notification-preference toggle, each its own hook
     * instance) mint exactly one device row between them.
     *
     * The lock is released in `finally` regardless of outcome: a failed
     * create must not strand every later registration — from any instance —
     * behind a promise that will never resolve.
     */
    const acquireCreatedDeviceId = useCallback(
        async (
            targetNetwork: Network,
            accounts: DeviceAccountRegistration[],
        ): Promise<{ id: string; joinedExisting: boolean }> => {
            const pending = pendingDeviceCreates.get(targetNetwork)
            if (pending) {
                return { id: await pending, joinedExisting: true }
            }

            const createPromise = createDeviceForNetwork(
                targetNetwork,
                accounts,
            )
            pendingDeviceCreates.set(targetNetwork, createPromise)
            try {
                const id = await createPromise
                return { id, joinedExisting: false }
            } finally {
                if (pendingDeviceCreates.get(targetNetwork) === createPromise) {
                    pendingDeviceCreates.delete(targetNetwork)
                }
            }
        },
        [createDeviceForNetwork],
    )

    /**
     * Registers `accounts` against a known device id. Used both for the
     * common case (id already in the store) and for a call that just joined
     * someone else's in-flight create — either way, this call didn't create
     * the device, so it must not drop its own accounts on the floor.
     */
    const registerWithId = useCallback(
        async (
            targetNetwork: Network,
            id: string,
            accounts: DeviceAccountRegistration[],
        ): Promise<{ createdNew: boolean }> => {
            const payload = { ...buildPayload(accounts), id }

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
                const recreated = await acquireCreatedDeviceId(
                    targetNetwork,
                    accounts,
                )
                if (!recreated.joinedExisting) return { createdNew: true }
                return registerWithId(targetNetwork, recreated.id, accounts)
            }
        },
        [buildPayload, register, acquireCreatedDeviceId],
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
     * which bounds that to one *per network*, even under concurrent callers
     * from different components (see `acquireCreatedDeviceId`).
     *
     * Reads the device id from the store directly at call time rather than
     * from a render-scoped selector: the lock above can release — and a
     * fresh id can land in the store — between when this component last
     * rendered and when this call actually runs. A stale render-scoped id
     * would send a second call down the id-less branch and mint a second
     * device row even though the store already holds one.
     *
     * Transient retries (5xx, network errors) are handled by ky inside the
     * shared query-client; layering another retry loop here would compound to
     * up to 6 requests per call. The single 400 retry below is different in
     * kind: it is a documented v3 write race, not a transport failure.
     *
     * The whole attempt — id read included — runs inside `enqueueRegistration`
     * (module scope, above), so two calls for the same network never run
     * concurrently: the second always sees whatever the first left behind,
     * whether that's a freshly minted id or a corrective write superseding an
     * earlier one still in flight.
     */
    const registerDevice = useCallback(
        (
            accounts: DeviceAccountRegistration[],
        ): Promise<RegisterDeviceResult> => {
            const targetNetwork = network
            return enqueueRegistration(targetNetwork, async () => {
                const currentDeviceId =
                    useDeviceStore.getState().deviceIDs.get(targetNetwork) ??
                    null

                if (!currentDeviceId) {
                    const { id, joinedExisting } = await acquireCreatedDeviceId(
                        targetNetwork,
                        accounts,
                    )
                    if (!joinedExisting) return { createdNew: true }
                    // Another in-flight call already minted the device;
                    // register THIS call's accounts against it instead of
                    // dropping them.
                    return registerWithId(targetNetwork, id, accounts)
                }

                return registerWithId(targetNetwork, currentDeviceId, accounts)
            })
        },
        [network, acquireCreatedDeviceId, registerWithId],
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
