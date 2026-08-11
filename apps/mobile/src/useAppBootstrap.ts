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

import { useEffect, useState } from 'react'
import * as SplashScreen from 'expo-splash-screen'
import {
    algorandSafeQuerySerialize,
    algorandSafeQueryParse,
} from '@perawallet/wallet-core-blockchain'
import { seedAlgoAsset } from '@perawallet/wallet-core-assets'
import { initializeSyncService } from '@perawallet/wallet-core-background'
import {
    initializeDatabase,
    getDatabase,
} from '@perawallet/wallet-core-database'
import {
    logger,
    updateBackendHeaders,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    readRemoteConfigWithOverrides,
    RemoteConfigKeys,
    useRemoteConfigStore,
} from '@perawallet/wallet-core-remote-config'
import { setOnConfirmedHandler } from '@perawallet/wallet-core-signing'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    getProvider,
    hydrateKeystore,
    usePeraProvider,
} from '@perawallet/wallet-extension-provider'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { type Persister } from '@tanstack/react-query-persist-client'
import { queryClient } from './providers/QueryProvider'
import { runPasskeyAutofillBootstrap } from './bootstrap/passkey-autofill'
import { waitForStoreHydration } from './bootstrap/waitForStoreHydration'
import { getEffectiveSupportedLocales } from './i18n/effectiveLocales'
import { resolveLocale } from './i18n/locales'
import i18n from './i18n'

export type UseAppBootstrapResult = {
    bootstrapped: boolean
    persister: Persister | undefined
    fcmToken: Nullable<string>
    initError: boolean
    retryBootstrap: () => void
}

// Ceiling on how long the splash may stay up once bootstrap has finished, for
// the case where no frames are being produced and the rAF pair never runs. Long
// enough that a foreground start always hides on the frame path instead.
const SPLASH_HIDE_BACKSTOP_MS = 1000

// Ceiling on the wait for store rehydration; see waitForStoreHydration for why
// an unguarded wait can hang forever.
const STORE_HYDRATION_TIMEOUT_MS = 2000

const updateQueryHeaders = () => {
    const deviceInfo = getProvider().deviceInfo
    const headers = new Map<string, string>()
    headers.set('App-Name', deviceInfo.getAppName())
    headers.set('App-Package-Name', deviceInfo.getAppPackage())
    headers.set('App-Version', deviceInfo.getAppVersion())
    headers.set('Client-Type', deviceInfo.getDevicePlatform())
    headers.set('Device-Version', deviceInfo.getDeviceLocale())
    headers.set('Device-OS-Version', deviceInfo.getDeviceOSVersion())
    headers.set('Device-Model', deviceInfo.getDeviceModelId())
    headers.set('User-Agent', deviceInfo.getUserAgent())
    updateBackendHeaders(headers)
}

const resolveEffectiveLocale = (): string => {
    // Reads the same dev-override layer `useRemoteConfig()` applies, via the
    // store's non-reactive getState — a flag flipped in the Feature Flags
    // screen has to survive the next cold start, and bootstrap runs outside
    // render so it can't call the hook.
    const remoteConfig = readRemoteConfigWithOverrides(
        getProvider().remoteConfig,
        useRemoteConfigStore.getState().configOverrides,
    )
    const isLanguageSelectionEnabled = remoteConfig.getBooleanValue(
        RemoteConfigKeys.enable_language_selection,
        false,
    )
    const activeLocalesRaw = remoteConfig.getStringValue(
        RemoteConfigKeys.active_locales,
        '',
    )
    const effectiveSupportedLocales = getEffectiveSupportedLocales(
        isLanguageSelectionEnabled,
        activeLocalesRaw,
    )
    const { language } = useSettingsStore.getState()
    const deviceLocales = getProvider().deviceInfo.getDeviceLocales()
    return resolveLocale(language, deviceLocales, effectiveSupportedLocales)
}

// Runs after rehydration, behind the bootstrapped splash gate, so switching
// language never causes a visible flash (design doc §4.4). Unlike
// i18n/index.ts's import-time BASE_LOCALE default, Remote Config has
// already been fetched by the time this runs (provider.initialize() above
// awaits it) — so this is the one place real locale resolution happens, for
// every user, not just ones with a saved override. A saved override that
// falls outside the currently-effective set (Remote Config rolled back, or
// that locale deactivated) correctly falls through resolveLocale's chain
// back to en, via resolveEffectiveLocale re-validating it every run.
// Timing out leaves `language` at the store's default ('system'), which just
// means a saved override is missed for this one launch — never a hang.
const syncLanguagePreference = async (): Promise<void> => {
    await waitForStoreHydration(useSettingsStore, STORE_HYDRATION_TIMEOUT_MS)
    const effectiveLocale = resolveEffectiveLocale()
    if (effectiveLocale !== i18n.language) {
        await i18n.changeLanguage(effectiveLocale)
    }
}

// Cold start is the only place the launch preference is applied (PERA-4855).
// Running it here — inside the bootstrap gate, before the splash lifts — means
// no visible flash of a non-pinned account. Deep links land strictly later,
// from mounted UI, so a notification tap still wins for that session.
const applyLaunchAccountPreference = async (): Promise<void> => {
    await waitForStoreHydration(useAccountsStore, STORE_HYDRATION_TIMEOUT_MS)
    useAccountsStore.getState().applyLaunchAccountPreference()
}

export const useAppBootstrap = (): UseAppBootstrapResult => {
    const [persister, setPersister] = useState<Persister>()
    const [bootstrapped, setBootstrapped] = useState(false)
    const [fcmToken, setFcmToken] = useState<Nullable<string>>(null)
    const [initError, setInitError] = useState<boolean>(false)
    const [retryNonce, setRetryNonce] = useState(0)
    const provider = usePeraProvider()

    const retryBootstrap = () => {
        setInitError(false)
        setRetryNonce(nonce => nonce + 1)
    }

    useEffect(() => {
        if (bootstrapped) {
            return
        }

        const runBootstrap = async () => {
            try {
                // Awaits crash reporting, remote config, analytics and SSL
                // pinning — which the calls below genuinely depend on — but not
                // push registration. That is bounded at several seconds and used
                // to hold the splash for the whole round trip on a slow or
                // offline start (PERA-4727); nothing in bootstrap needs the
                // token, so it lands whenever it lands.
                const { notifications } = await provider.initialize()
                void notifications.then(({ token }) =>
                    setFcmToken(token ?? null),
                )

                // do startup hydration and setup in parallel to speed up time
                // to interactive. Keystore/database failures must fail the whole
                // bootstrap; only the passkey branch is allowed to fail silently.
                const keystoreBranch = hydrateKeystore().catch(err => {
                    logger.error('Keystore hydration failed', { error: err })
                    throw err
                })

                const passkeyBranch = runPasskeyAutofillBootstrap().catch(err =>
                    logger.error('Passkey autofill bootstrap failed', {
                        error: err,
                    }),
                )

                const databaseBranch = initializeDatabase(
                    provider.database,
                ).then(() => seedAlgoAsset(getDatabase()))

                const languageBranch = syncLanguagePreference().catch(err =>
                    logger.error('Language preference sync failed', {
                        error: err,
                    }),
                )

                const launchAccountBranch =
                    applyLaunchAccountPreference().catch(err =>
                        logger.error('Launch account preference failed', {
                            error: err,
                        }),
                    )

                await Promise.all([
                    keystoreBranch,
                    passkeyBranch,
                    databaseBranch,
                    languageBranch,
                    launchAccountBranch,
                ])

                initializeSyncService({
                    queryClient,
                    registerCompletionHandler: setOnConfirmedHandler,
                })

                updateQueryHeaders()

                const reactQueryPersistor = createAsyncStoragePersister({
                    storage: provider.keyValueStorage,
                    serialize: algorandSafeQuerySerialize,
                    deserialize: algorandSafeQueryParse,
                })

                setPersister(reactQueryPersistor)

                setBootstrapped(true)
            } catch (err) {
                logger.error('App bootstrap failed', { error: err })
                setInitError(true)
            } finally {
                // Deferred so the initial layout lands before the native splash
                // goes away. Two frames is what that actually needs; the
                // previous flat 200ms charged every cold start the full delay
                // however fast the first paint was (PERA-4727).
                //
                // The timer is a backstop, not a duplicate: rAF does not fire
                // while the app is producing no frames, so a cold start that
                // begins in the background — push-launched, or iOS prewarming —
                // would otherwise sit on the splash until the user foregrounds
                // it. `setTimeout` fires regardless, which is the one property
                // the old code had and this must not lose. Whichever runs first
                // wins; `hideSplash` is idempotent.
                let splashHidden = false
                const hideSplash = () => {
                    if (splashHidden) return
                    splashHidden = true
                    void SplashScreen.hideAsync()
                }

                requestAnimationFrame(() => {
                    requestAnimationFrame(hideSplash)
                })
                setTimeout(hideSplash, SPLASH_HIDE_BACKSTOP_MS)
            }
        }

        void runBootstrap()
    }, [bootstrapped, provider, retryNonce])

    return {
        bootstrapped,
        persister,
        fcmToken,
        initError,
        retryBootstrap,
    }
}
