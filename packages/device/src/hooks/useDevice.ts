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
import { logEvent } from '@perawallet/wallet-core-analytics'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useRegisterDeviceMutation } from './useRegisterDeviceMutation'
import { usePushToken } from './usePushToken'
import { useDeviceStore } from '../store'
import { registerDevice as registerDeviceEndpoint } from './endpoints'
import type {
    DeviceAccountRegistration,
    DeviceRegistration,
    DeviceResponse,
} from '../models'

const MIGRATED_DEVICE_ID_REPLACED_EVENT = 'migrated_device_id_replaced'

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
// a completely different screen, any future caller — must share ONE queue per
// network. A per-hook-instance queue only serializes calls made through that
// same mounted instance; two different components calling `registerDevice`
// concurrently would each get their own empty map and still fire two
// independent POSTs.
//
// This queue is the *only* thing that guarantees one id-less create per
// network: an id-less call and any call that follows it are chained through
// one promise, so the second always observes the id the first persisted and
// takes the update branch instead of minting a second device row. Do not
// weaken it into a per-call-path lock — `registerDevice` has more than one
// caller per mounted app (the account/network-driven registrar in
// `useDeviceRegistration`, and the notification toggle,
// `useAccountNotificationToggle`) and both usually hold the id
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
    const setDeviceIdOrigin = useDeviceStore(state => state.setDeviceIdOrigin)
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

    /**
     * The single seam between this hook and the transport. Both write paths —
     * the id-less create and the id-carrying update — go through here so the
     * documented "400 → retry once" rule cannot drift between them: a 400 on
     * the create path is exactly the v1→v3 id transition (stale id 404s, the
     * id-less re-create then collides with the old row still holding this FCM
     * token) and without the retry there is no self-heal, only the same 400
     * on every reconnect and foreground for the life of the install.
     *
     * `targetNetwork` is passed explicitly rather than left to the mutation's
     * own `useNetwork()`: this runs inside a queued task that may start long
     * after the call was enqueued, by which point the user may have switched
     * networks. See `registerDevice`.
     *
     * Exactly one replay, and only for 400. Anything else — 404, 422, 5xx, a
     * dropped connection — propagates on the first failure.
     */
    const submitRegistration = useCallback(
        async (
            targetNetwork: Network,
            payload: DeviceRegistration,
        ): Promise<DeviceResponse> => {
            try {
                return await register({ network: targetNetwork, data: payload })
            } catch (error) {
                if (!isPushTokenClaimedError(error)) throw error
                return register({ network: targetNetwork, data: payload })
            }
        },
        [register],
    )

    // The one place that ever issues an id-less POST. Persists the id it gets
    // back immediately. Only one of these can be in flight per network at a
    // time — not because of any lock here, but because every caller reaches
    // this through `enqueueRegistration` (see `registerDevice`), which chains
    // one task at a time per network. A late-arriving write here can only
    // ever land in its own, still-current slot.
    const createDeviceForNetwork = useCallback(
        async (
            targetNetwork: Network,
            accounts: DeviceAccountRegistration[],
        ): Promise<string> => {
            const result = await submitRegistration(
                targetNetwork,
                buildPayload(accounts),
            )
            if (!result.id) {
                // Storing null would report this registration as healed while
                // useIsDeviceRegistrationPending stays true forever. Fail the
                // attempt instead so the reconnect/foreground retry re-runs it.
                throw new Error('Device create response carried no id')
            }
            setDeviceID(targetNetwork, result.id)
            return result.id
        },
        [buildPayload, submitRegistration, setDeviceID],
    )

    /** Registers `accounts` against a known device id. */
    const registerWithId = useCallback(
        async (
            targetNetwork: Network,
            id: string,
            accounts: DeviceAccountRegistration[],
        ): Promise<RegisterDeviceResult> => {
            try {
                await submitRegistration(targetNetwork, {
                    ...buildPayload(accounts),
                    id,
                })
                return { createdNew: false }
            } catch (error) {
                // Anything that isn't a stale id — 422 validation, 401, an
                // unexpected 4xx — propagates untouched. Retrying a malformed
                // payload cannot fix it, and re-creating would hide the bug
                // behind a duplicate device.
                if (!shouldRecreateDevice(error)) throw error
                // Read live from the store rather than a subscribed snapshot:
                // the origin is only needed at recreate time, and subscribing
                // would rebuild this callback on every unrelated origin flip.
                const isReplacingMigratedId =
                    useDeviceStore.getState().deviceIdOrigins[targetNetwork] ===
                    'migrated'
                await createDeviceForNetwork(targetNetwork, accounts)
                // Replacing a migrated id orphans its device-keyed server
                // state (Discover favorites, price alerts, banner
                // dismissals) — no reconciliation endpoint exists yet,
                // so the loss is only made observable here.
                //
                // No in-flight guard is needed: every registration is chained
                // through `enqueueRegistration`, so only one task per network
                // runs at a time and this recreate cannot be superseded while
                // it is in flight (see `registerDevice`).
                //
                // `reason` is always `not_found` here:
                // `shouldRecreateDevice` matches 404 only, because a 400 is a
                // push-token race that must be retried rather than re-created
                // (see `isPushTokenClaimedError`). A 400 therefore never
                // reaches this branch and never replaces an id.
                if (isReplacingMigratedId) {
                    setDeviceIdOrigin(targetNetwork, 'recreated')
                    logEvent(MIGRATED_DEVICE_ID_REPLACED_EVENT, {
                        network: targetNetwork,
                        reason: 'not_found',
                    })
                }
                return { createdNew: true }
            }
        },
        [
            buildPayload,
            submitRegistration,
            createDeviceForNetwork,
            setDeviceIdOrigin,
        ],
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
     * from different components.
     *
     * Reads the device id from the store directly at call time rather than
     * from a render-scoped selector: a fresh id can land in the store between
     * when this component last rendered and when this call actually runs. A
     * stale render-scoped id would send a second call down the id-less branch
     * and mint a second device row even though the store already holds one.
     *
     * No transport-level retry. ky's shared pera client leaves `retry.methods`
     * at its default (`get`/`put`/`head`/`delete`/`options`/`trace`) and v3
     * collapsed v1's `PUT` update into a `POST`, so a 5xx or a dropped
     * connection here fails on its first attempt. That is deliberate:
     * `peraRetryConfig` is shared by every pera-backend POST, swap submission
     * included, so `'post'` must not be added to it. Registration is
     * best-effort — `useDeviceRegistration` re-fires on reconnect and
     * foreground, and `useIsDeviceRegistrationPending` keeps reporting until
     * one attempt lands. The single 400 retry in `submitRegistration` is
     * different in kind: it is a documented v3 write race, and ky would not
     * retry a 400 for any method anyway.
     *
     * The whole attempt — id read included — runs inside `enqueueRegistration`
     * (module scope, above), so two calls for the same network never run
     * concurrently: the second always sees whatever the first left behind,
     * whether that's a freshly minted id or a corrective write superseding an
     * earlier one still in flight.
     *
     * `targetNetwork` is captured at *enqueue* time and threaded all the way
     * to the transport. The queued task can start up to one request timeout
     * after the call was made, and the user may have switched networks in
     * between: re-reading the network inside the task would read this
     * network's device id, POST it to the *other* network's backend (unknown
     * id → 404 → re-create) and then write that foreign id back into this
     * network's store slot, pointing both networks at one device row.
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
                    await createDeviceForNetwork(targetNetwork, accounts)
                    return { createdNew: true }
                }

                return registerWithId(targetNetwork, currentDeviceId, accounts)
            })
        },
        [network, createDeviceForNetwork, registerWithId],
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
