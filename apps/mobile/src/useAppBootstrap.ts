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
import { setOnConfirmedHandler } from '@perawallet/wallet-core-signing'
import {
    getProvider,
    hydrateKeystore,
    usePeraProvider,
} from '@perawallet/wallet-extension-provider'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { type Persister } from '@tanstack/react-query-persist-client'
import { queryClient } from './providers/QueryProvider'
import { runPasskeyAutofillBootstrap } from './bootstrap/passkey-autofill'

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

                await Promise.all([
                    keystoreBranch,
                    passkeyBranch,
                    databaseBranch,
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
