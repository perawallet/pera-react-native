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

import {
    commitSecret,
    removeSecret,
    withSecret,
} from '@perawallet/wallet-core-kms'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { setRefreshHandler } from '../api/transport'
import { refreshTokenRequest } from '../api/auth'
import { useCardSessionStore } from '../store/session-store'
import type { CardSessionTokens } from '../models'
import { clearTokenCache, setCachedAccessToken } from './token-cache'

const ACCESS_TOKEN_ID = 'baanx-access-token'
const REFRESH_TOKEN_ID = 'baanx-refresh-token'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const readSecretString = (id: string): Promise<Nullable<string>> =>
    withSecret(id, bytes => textDecoder.decode(bytes))

/** Persists tokens to the keystore + memory cache and flips the session on. */
export const setCardSession = async (
    tokens: CardSessionTokens,
): Promise<void> => {
    await commitSecret({
        id: ACCESS_TOKEN_ID,
        bytes: textEncoder.encode(tokens.accessToken),
    })
    if (tokens.refreshToken) {
        await commitSecret({
            id: REFRESH_TOKEN_ID,
            bytes: textEncoder.encode(tokens.refreshToken),
        })
    }
    setCachedAccessToken(tokens.accessToken, tokens.expiresAt)
    useCardSessionStore.getState().setSession({
        isAuthenticated: true,
        expiresAt: tokens.expiresAt,
    })
}

/** Clears tokens from the keystore + cache and resets the session flags. */
export const clearCardSession = async (): Promise<void> => {
    await removeSecret(ACCESS_TOKEN_ID)
    await removeSecret(REFRESH_TOKEN_ID)
    clearTokenCache()
    useCardSessionStore.getState().resetState()
}

/**
 * Refresh handler invoked by the transport on a 401. Returns whether a usable
 * access token is now in place. On any failure the session is cleared so the
 * UI routes the user back to login.
 */
export const refreshSession = async (): Promise<boolean> => {
    try {
        const refreshToken = await readSecretString(REFRESH_TOKEN_ID)
        if (!refreshToken) {
            await clearCardSession()
            return false
        }
        const { network } = useNetworkStore.getState()
        const tokens = await refreshTokenRequest({ refreshToken, network })
        await setCardSession(tokens)
        return true
    } catch (error) {
        logger.warn('Baanx session refresh failed', { error })
        await clearCardSession()
        return false
    }
}

/**
 * Bootstraps the session at app start: registers the refresh handler with the
 * transport and hydrates the in-memory access token from the keystore. Call
 * once after the keystore is hydrated (see App.tsx).
 */
export const initCardSession = async (): Promise<void> => {
    setRefreshHandler(refreshSession)
    const accessToken = await readSecretString(ACCESS_TOKEN_ID)
    if (accessToken) {
        const { expiresAt } = useCardSessionStore.getState()
        setCachedAccessToken(accessToken, expiresAt ?? 0)
    }
}
