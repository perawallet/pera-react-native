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
    getActiveLocale,
    isNotFoundError,
    isPeraNetworkError,
} from '@perawallet/wallet-core-shared'
import {
    networkTierForMode,
    type ChainId,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import { useWalletDeployment } from '@perawallet/wallet-core-chain-shared'
import {
    toFiatCurrencyPreference,
    useCurrenciesStore,
} from '@perawallet/wallet-core-currencies'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useRegisterDeviceMutation } from './useRegisterDeviceMutation'
import { usePushToken } from './usePushToken'
import {
    deviceIdForDeployment,
    deviceIdOriginFor,
    useDeviceStore,
} from '../store'
import { logEvent } from '../analytics'
import { registerDevice as registerDeviceEndpoint } from './endpoints'
import { withoutNewestChain } from '../registrations/withoutNewestChain'
import type {
    DeviceAccountRegistration,
    DeviceRegistration,
    DeviceResponse,
} from '../models'

const MIGRATED_DEVICE_ID_REPLACED_EVENT = 'migrated_device_id_replaced'

/**
 * The API returns 404 when the id we hold is unknown — it never auto-creates. A
 * stale id (env reset, device deleted server-side) heals by registering again
 * without one.
 */
const shouldRecreateDevice = (error: unknown): boolean => isNotFoundError(error)

/**
 * The API returns 400 when another device claimed this push token at the same
 * moment. The documented remedy is a retry, not a re-create: re-creating on
 * this race leaves a duplicate device row behind.
 */
const isPushTokenClaimedError = (error: unknown): boolean =>
    isPeraNetworkError(error) && error.status === 400

const DEVICE_CHAIN_REFUSAL_CODES: readonly string[] = [
    'unknown_chain',
    'chain_not_enabled',
]

/**
 * A 422 refusing a chain the request names rejects the whole registration,
 * so a chain the backend doesn't know yet would otherwise keep every other
 * chain's accounts unregistered too.
 */
const isChainRefusedError = (error: unknown): boolean =>
    isPeraNetworkError(error) &&
    error.status === 422 &&
    error.backendCode !== undefined &&
    DEVICE_CHAIN_REFUSAL_CODES.includes(error.backendCode)

type RegisterDeviceResult = { createdNew: boolean }

/**
 * `refusal` is set when the backend accepted a create only with no accounts:
 * the device exists, but nothing was registered on it.
 */
type SubmitRegistrationResult = {
    response: DeviceResponse
    refusal?: unknown
}

// Module scope, deliberately NOT a `useRef`: every `useDevice()` call site —
// the mount-time registration, a notification-preference toggle mounted from
// a completely different screen, any future caller — must share ONE queue per
// deployment. A per-hook-instance queue only serializes calls made through that
// same mounted instance; two different components calling `registerDevice`
// concurrently would each get their own empty map and still fire two
// independent POSTs.
//
// This queue is the *only* thing that guarantees one id-less create per
// deployment: an id-less call and any call that follows it are chained through
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
// deployment instead guarantees strict arrival order, so the corrective call
// always resolves last.
const registrationQueues = new Map<WalletMode, Promise<void>>()

// Chains a deployment refused this session, left out of later registrations
// so each one doesn't pay a failing request first. A refusal names no chain,
// so only the chain whose removal let a request through is recorded; one the
// fallback dropped on the way is tried again next time. Deliberately kept
// until relaunch, not retried on foreground or reconnect: those re-fires would
// each pay the refusal again for a chain the backend rolls out by deploy.
const refusedChainsByDeployment = new Map<WalletMode, ReadonlySet<ChainId>>()

/**
 * Tests only — never call from production code. The map above is module
 * state, so without this a leaked, never-settled entry from one test (e.g.
 * one that fails before resolving its own mocked in-flight promise) silently
 * wedges every later test in the same file that registers on the same
 * deployment.
 */
export const clearRegistrationQueuesForTests = (): void => {
    registrationQueues.clear()
    refusedChainsByDeployment.clear()
}

const enqueueRegistration = (
    targetDeployment: WalletMode,
    task: () => Promise<RegisterDeviceResult>,
): Promise<RegisterDeviceResult> => {
    const previous = registrationQueues.get(targetDeployment)
    // Run synchronously (no queue in front of it) when nothing is pending —
    // matches the pre-existing behaviour callers rely on, where the create
    // POST fires within the same tick as the call rather than one microtask
    // later. Only an actual pending predecessor defers this call.
    const result = previous ? previous.then(task) : task()
    // Always-resolving tail: one call's rejection must not wedge every
    // later call for this deployment behind a promise that will never settle.
    registrationQueues.set(
        targetDeployment,
        result.then(
            () => undefined,
            () => undefined,
        ),
    )
    return result
}

export const useDevice = () => {
    const deviceIDs = useDeviceStore(state => state.deviceIDs)
    const deployment = useWalletDeployment()
    const { pushToken } = usePushToken()
    const setDeviceID = useDeviceStore(state => state.setDeviceID)
    const setDeviceIdOrigin = useDeviceStore(state => state.setDeviceIdOrigin)
    const deviceInfoService = getProvider().deviceInfo

    const { mutateAsync: register } = useRegisterDeviceMutation()

    // The API requires push_token, locale and app_version on every call;
    // there is no "omit to keep the stored value" path. A null token becomes
    // '' — see the id rule on `registerDevice` for why that is safe.
    //
    // A fiat, not the raw preference: the backend renders notifications in
    // fiat only, so a non-fiat preference would render USD anyway.
    const notificationCurrency = useCurrenciesStore(
        state => toFiatCurrencyPreference(state).preferredCurrency,
    )

    const buildPayload = useCallback(
        (accounts: DeviceAccountRegistration[]): DeviceRegistration => ({
            accounts,
            platform: deviceInfoService.getDevicePlatform(),
            pushToken: pushToken ?? '',
            // The backend renders every push in this locale, so it is the app's
            // language, not the phone's: they differ whenever the user picked one
            // in Settings.
            locale: getActiveLocale(),
            appVersion: deviceInfoService.getAppVersion(),
            currency: notificationCurrency,
        }),
        [deviceInfoService, pushToken, notificationCurrency],
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
     * `targetDeployment` is passed explicitly rather than left to the mutation's
     * own `useWalletDeployment()`: this runs inside a queued task that may start long
     * after the call was enqueued, by which point the user may have switched
     * deployments. See `registerDevice`.
     *
     * Exactly one replay, and only for 400. Anything else — 404, 422, 5xx, a
     * dropped connection — propagates on the first failure; a chain refusal
     * then narrows the payload in `submitRegistration`.
     */
    const submitOnce = useCallback(
        async (
            targetDeployment: WalletMode,
            payload: DeviceRegistration,
        ): Promise<DeviceResponse> => {
            try {
                return await register({
                    deployment: targetDeployment,
                    data: payload,
                })
            } catch (error) {
                if (!isPushTokenClaimedError(error)) throw error
                return register({
                    deployment: targetDeployment,
                    data: payload,
                })
            }
        },
        [register],
    )

    /**
     * Beyond the single 400 replay in `submitOnce`, a chain refusal re-submits
     * without the newest chain until the backend accepts or only the oldest
     * chain is left, so one unknown chain never keeps the rest unregistered.
     * On an update, a refusal of that last chain propagates rather than
     * registering no accounts: every request replaces the device's whole
     * account list, so an empty one would unregister accounts the backend
     * already holds. A create has no list to lose, so it goes through with no
     * accounts: the device still needs an id, which every device-keyed
     * feature reads. The refusal comes back with that response so the caller
     * can save the id and still fail the attempt.
     */
    const submitRegistration = useCallback(
        async (
            targetDeployment: WalletMode,
            payload: DeviceRegistration,
        ): Promise<SubmitRegistrationResult> => {
            const refused =
                refusedChainsByDeployment.get(targetDeployment) ??
                new Set<ChainId>()
            let accounts = payload.accounts.filter(
                account => !refused.has(account.chainId),
            )
            let lastDropped: ReadonlySet<ChainId> = new Set()
            let emptyCreateRefusal: unknown
            for (;;) {
                try {
                    const response = await submitOnce(targetDeployment, {
                        ...payload,
                        accounts,
                    })
                    if (emptyCreateRefusal !== undefined) {
                        // An accepted empty create proves nothing about its
                        // last chain, so that chain is tried again next time.
                        return { response, refusal: emptyCreateRefusal }
                    }
                    if (lastDropped.size > 0) {
                        refusedChainsByDeployment.set(
                            targetDeployment,
                            new Set([...refused, ...lastDropped]),
                        )
                    }
                    return { response }
                } catch (error) {
                    if (!isChainRefusedError(error)) throw error
                    let narrowed = withoutNewestChain(accounts)
                    if (
                        narrowed === null &&
                        payload.id === undefined &&
                        accounts.length > 0
                    ) {
                        emptyCreateRefusal = error
                        narrowed = []
                    }
                    if (narrowed === null) throw error
                    const kept = new Set(narrowed.map(each => each.chainId))
                    lastDropped = new Set(
                        accounts
                            .map(each => each.chainId)
                            .filter(chainId => !kept.has(chainId)),
                    )
                    accounts = narrowed
                }
            }
        },
        [submitOnce],
    )

    // The one place that ever issues an id-less POST. Persists the id it gets
    // back immediately. Only one of these can be in flight per deployment at a
    // time — not because of any lock here, but because every caller reaches
    // this through `enqueueRegistration` (see `registerDevice`), which chains
    // one task at a time per deployment. A late-arriving write here can only
    // ever land in its own, still-current slot.
    const createDeviceForDeployment = useCallback(
        async (
            targetDeployment: WalletMode,
            accounts: DeviceAccountRegistration[],
        ): Promise<string> => {
            const { response: result, refusal } = await submitRegistration(
                targetDeployment,
                buildPayload(accounts),
            )
            if (!result.id) {
                // Storing null would report this registration as healed while
                // useIsDeviceRegistrationPending stays true forever. Fail the
                // attempt instead so the reconnect/foreground retry re-runs it.
                throw new Error('Device create response carried no id')
            }
            setDeviceID(targetDeployment, result.id)
            // The id is kept, but nothing was registered on it: fail the
            // attempt so the registration stays pending and the retry, now an
            // update, sends the accounts again.
            if (refusal !== undefined) throw refusal
            return result.id
        },
        [buildPayload, submitRegistration, setDeviceID],
    )

    /** Registers `accounts` against a known device id. */
    const registerWithId = useCallback(
        async (
            targetDeployment: WalletMode,
            id: string,
            accounts: DeviceAccountRegistration[],
        ): Promise<RegisterDeviceResult> => {
            try {
                await submitRegistration(targetDeployment, {
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
                    deviceIdOriginFor(
                        useDeviceStore.getState(),
                        targetDeployment,
                    ) === 'migrated'
                const staleId = deviceIdForDeployment(
                    useDeviceStore.getState(),
                    targetDeployment,
                )
                try {
                    await createDeviceForDeployment(targetDeployment, accounts)
                } finally {
                    // A create refused on its only chain saves the new id and
                    // still throws, so the bookkeeping runs on the stored id,
                    // not on the create resolving.
                    const isIdReplaced =
                        deviceIdForDeployment(
                            useDeviceStore.getState(),
                            targetDeployment,
                        ) !== staleId
                    if (isReplacingMigratedId && isIdReplaced) {
                        setDeviceIdOrigin(targetDeployment, 'recreated')
                        logEvent(MIGRATED_DEVICE_ID_REPLACED_EVENT, {
                            network: networkTierForMode(targetDeployment),
                            reason: 'not_found',
                        })
                    }
                }
                // Replacing a migrated id orphans its device-keyed server
                // state (Discover favorites, price alerts, banner
                // dismissals) — no reconciliation endpoint exists yet,
                // so the loss is only made observable here.
                //
                // No in-flight guard is needed: every registration is chained
                // through `enqueueRegistration`, so only one task per deployment
                // runs at a time and this recreate cannot be superseded while
                // it is in flight (see `registerDevice`).
                //
                // `reason` is always `not_found` here:
                // `shouldRecreateDevice` matches 404 only, because a 400 is a
                // push-token race that must be retried rather than re-created
                // (see `isPushTokenClaimedError`). A 400 therefore never
                // reaches this branch and never replaces an id.
                return { createdNew: true }
            }
        },
        [
            buildPayload,
            submitRegistration,
            createDeviceForDeployment,
            setDeviceIdOrigin,
        ],
    )

    /**
     * Single-attempt registration. `createdNew` tells callers whether this
     * attempt created a fresh device record (no prior id, or a 404 recreate)
     * versus updating an existing one.
     *
     * **Once an id exists we always send it.** The API mints a brand-new device for
     * every id-less call carrying an empty push token, so the only id-less
     * call is the first registration on a device whose FCM token hasn't
     * arrived (or was denied) — and the returned id is persisted immediately,
     * which bounds that to one *per deployment*, even under concurrent callers
     * from different components.
     *
     * Reads the device id from the store directly at call time rather than
     * from a render-scoped selector: a fresh id can land in the store between
     * when this component last rendered and when this call actually runs. A
     * stale render-scoped id would send a second call down the id-less branch
     * and mint a second device row even though the store already holds one.
     *
     * No transport-level retry. ky's shared pera client leaves `retry.methods`
     * at its default (`get`/`put`/`head`/`delete`/`options`/`trace`) and the
     * API takes updates as a `POST`, so a 5xx or a dropped
     * connection here fails on its first attempt. That is deliberate:
     * `peraRetryConfig` is shared by every pera-backend POST, swap submission
     * included, so `'post'` must not be added to it. Registration is
     * best-effort — `useDeviceRegistration` re-fires on reconnect and
     * foreground, and `useIsDeviceRegistrationPending` keeps reporting until
     * one attempt lands. The single 400 retry in `submitOnce` is
     * different in kind: it is a documented write race, and ky would not
     * retry a 400 for any method anyway.
     *
     * The whole attempt — id read included — runs inside `enqueueRegistration`
     * (module scope, above), so two calls for the same deployment never run
     * concurrently: the second always sees whatever the first left behind,
     * whether that's a freshly minted id or a corrective write superseding an
     * earlier one still in flight.
     *
     * `targetDeployment` is captured at *enqueue* time and threaded all the way
     * to the transport. The queued task can start up to one request timeout
     * after the call was made, and the user may have switched deployments in
     * between: re-reading the deployment inside the task would read this
     * deployment's device id, POST it to the *other* deployment's backend
     * (unknown id → 404 → re-create) and then write that foreign id back into
     * this deployment's store slot, pointing both at one device row.
     */
    const registerDevice = useCallback(
        (
            accounts: DeviceAccountRegistration[],
        ): Promise<RegisterDeviceResult> => {
            const targetDeployment = deployment
            return enqueueRegistration(targetDeployment, async () => {
                const currentDeviceId = deviceIdForDeployment(
                    useDeviceStore.getState(),
                    targetDeployment,
                )

                if (!currentDeviceId) {
                    await createDeviceForDeployment(targetDeployment, accounts)
                    return { createdNew: true }
                }

                return registerWithId(
                    targetDeployment,
                    currentDeviceId,
                    accounts,
                )
            })
        },
        [deployment, createDeviceForDeployment, registerWithId],
    )

    /**
     * Detach the push token from the device record on a specific deployment so
     * the server stops pushing to one we've moved away from. Best-effort:
     * any failure is swallowed (incl. 404 when the device was already deleted
     * server-side).
     *
     * Routed via the raw endpoint so we hit the *target* deployment's URL rather
     * than `useWalletDeployment()`'s current value, which has already advanced by the
     * time this fires. Carrying `id` is what makes `pushToken: ''` clear that
     * device instead of minting a new one. `accounts` is `[]` so this can't
     * overwrite the old deployment's account list with the new one's.
     */
    const clearDevicePushToken = useCallback(
        async (targetDeployment: WalletMode) => {
            const targetDeviceId = deviceIdForDeployment(
                { deviceIDs },
                targetDeployment,
            )
            if (!targetDeviceId) return
            try {
                await registerDeviceEndpoint(targetDeployment, {
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
