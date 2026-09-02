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

import { useEffect } from 'react'
import { AppState } from 'react-native'
import {
    bootstrapPasskeyAutofill,
    type PasskeyAutofillService,
} from '@perawallet/wallet-core-passkeys'
import {
    getKeystoreStore,
    getProvider,
    reconcileKeystore,
} from '@perawallet/wallet-extension-provider'
import { logger } from '@perawallet/wallet-core-shared'

const PASSKEY_INTENT_ACTIONS = {
    getPasskeyAction: 'com.algorand.perarn.passkeyautofill.GET_PASSKEY',
    createPasskeyAction: 'com.algorand.perarn.passkeyautofill.CREATE_PASSKEY',
}

const getService = (): PasskeyAutofillService | undefined => {
    const provider = getProvider() as unknown as {
        passkeyAutofill?: PasskeyAutofillService
    }
    return provider.passkeyAutofill
}

/**
 * Runs the passkey autofill bootstrap. Safe to call multiple times — the
 * package serializes overlapping invocations into a single in-flight run.
 */
export const runPasskeyAutofillBootstrap = async (): Promise<void> => {
    const service = getService()
    if (!service) {
        logger.warn(
            'Provider missing passkeyAutofill extension; skipping bootstrap',
        )
        return
    }

    await bootstrapPasskeyAutofill({
        service,
        intentActions: PASSKEY_INTENT_ACTIONS,
    })
}

/**
 * App-lifetime side effects for the passkey autofill subsystem:
 *
 *  - Re-bootstrap when the keystore's reactive store changes (keys hydrated
 *    on cold start, or a wallet imported/created mid-session). This is the
 *    primary path that hands the HD root key id to the native side — the
 *    first cold-start bootstrap can run before hydration has populated the
 *    store, so we must re-run once the seed key appears.
 *  - Re-bootstrap when the app returns to the foreground (e.g. after the user
 *    enabled the credential provider in system settings).
 *  - Re-bootstrap when the native side reports a passkey was registered or
 *    authenticated via the system credential provider.
 */
export const usePasskeyAutofillLifecycle = (): void => {
    useEffect(() => {
        const service = getService()
        if (!service) return

        const handleRefresh = () => {
            // Pull any keys the credential provider wrote to MMKV out-of-process
            // (e.g. a passkey just registered via the system UI) into the
            // reactive store so the Settings list reflects them without a
            // cold-start re-hydration.
            reconcileKeystore()
                .then(({ failedIds }) => {
                    if (failedIds.length > 0) {
                        // Skipped this session, but the strict hydration will
                        // fail on these exact records at the next cold start.
                        logger.error(
                            `Keystore reconcile skipped undecodable records: ${failedIds.join(', ')}`,
                        )
                    }
                })
                .catch(err =>
                    logger.error(err as Error, {
                        step: 'passkeyAutofillReconcile',
                    }),
                )
            runPasskeyAutofillBootstrap().catch(err =>
                logger.error(err as Error, {
                    step: 'passkeyAutofillRefresh',
                }),
            )
        }

        // Re-run whenever the number of keystore keys changes — covers the
        // hydration race (keys arrive after the first bootstrap) and wallets
        // imported after launch. Status-only updates are ignored.
        let lastKeyCount = getKeystoreStore().state.keys.length
        const keystoreSub = getKeystoreStore().subscribe(() => {
            const nextCount = getKeystoreStore().state.keys.length
            if (nextCount !== lastKeyCount) {
                lastKeyCount = nextCount
                handleRefresh()
            }
        })

        const appStateSub = AppState.addEventListener('change', state => {
            if (state === 'active') handleRefresh()
        })

        const addedSub = service.onPasskeyAdded(handleRefresh)
        const authedSub = service.onPasskeyAuthenticated(handleRefresh)

        return () => {
            keystoreSub.unsubscribe()
            appStateSub.remove()
            addedSub.remove()
            authedSub.remove()
        }
    }, [])
}
