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
import { config } from '@perawallet/wallet-core-config'
import {
    setIntegrityTokenProvider,
    logger,
} from '@perawallet/wallet-core-shared'
import {
    getValidIntegrityToken,
    useAppIntegrityStore,
} from '@perawallet/wallet-core-app-integrity'
import {
    INTEGRITY_TOKEN_SESSION_KEY,
    getSessionIntegrityToken,
    onSessionStorageKeyChanged,
} from '@perawallet/wallet-extension-platform-chrome'

/**
 * Mirrors the service worker's minted token into this realm's store. The SW is
 * the sole minter; UI realms only read. Mounted from AppShell.web (never
 * App.web) because it touches a Zustand store — see the boot-order contract
 * in App.web.tsx.
 */
export const useIntegrityTokenSync = (): void => {
    useEffect(() => {
        if (!config.webIntegrityBearerEnabled) return

        setIntegrityTokenProvider(getValidIntegrityToken)

        const adopt = async (): Promise<void> => {
            try {
                const token = await getSessionIntegrityToken()
                if (!token) {
                    // The SW removes the session token on revocation (403);
                    // clear this realm's store too, or getValidIntegrityToken
                    // keeps serving the revoked JWT until its unchanged
                    // expiresAt.
                    useAppIntegrityStore.getState().resetState()
                    return
                }
                useAppIntegrityStore.getState().setRegistration({
                    integrityToken: token.integrityToken,
                    expiresAt: token.expiresAt,
                    keyId: null,
                    deviceInstallationId: token.deviceInstallationId,
                })
            } catch (error) {
                logger.warn('Adopting the session integrity token failed', {
                    error,
                })
            }
        }

        void adopt()

        return onSessionStorageKeyChanged([INTEGRITY_TOKEN_SESSION_KEY], () => {
            void adopt()
        })
    }, [])
}
