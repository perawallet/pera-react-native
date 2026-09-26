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

import {
    commitSecret,
    hasSecret,
    removeSecret,
    withSecret,
    zeroBytes,
} from '@perawallet/wallet-core-kms'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'
import { setRefreshHandler } from '../api/transport'
import { refreshTokenRequest } from '../api/auth'
import { useCardSessionStore } from '../store/session-store'
import type { CardSessionTokens } from '../models'
import { ACCESS_TOKEN_SECRET_ID, REFRESH_TOKEN_SECRET_ID } from './secret-ids'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

// Encodes a token, commits it to the keystore, then zeroes the byte buffer we
// created. (The source JS string can't be zeroed — strings are immutable — but
// it's never cached and is GC'd; the durable copy in the keystore is encrypted.)
const commitTokenSecret = async (id: string, token: string): Promise<void> => {
    const bytes = textEncoder.encode(token)
    try {
        await commitSecret({ id, bytes })
    } finally {
        zeroBytes(bytes)
    }
}

/**
 * Persists tokens to the encrypted keystore and flips the auth flag. The tokens
 * are never cached in app memory — they are read back from the keystore on
 * demand (see baanx-client). Both login and registration finalize complete the
 * OAuth exchange, so sessions normally carry a refresh token; an empty
 * refreshToken occurs only via the exchange-failure fallback
 * (acquireCardSessionTokens) and yields a session that logs out on its first
 * 401. An empty refreshToken also REMOVES any prior refresh secret — a stale
 * one from an earlier session must never be exchanged against this session's
 * access token.
 */
export const setCardSession = async (
    tokens: CardSessionTokens,
): Promise<void> => {
    await commitTokenSecret(ACCESS_TOKEN_SECRET_ID, tokens.accessToken)
    if (tokens.refreshToken) {
        await commitTokenSecret(REFRESH_TOKEN_SECRET_ID, tokens.refreshToken)
    } else {
        await removeSecret(REFRESH_TOKEN_SECRET_ID)
    }
    useCardSessionStore.getState().setAuthenticated(true)
}

/**
 * Whether a usable card access token is in the keystore. Unlike the persisted
 * `isAuthenticated` flag, this reflects the real session — use it to gate
 * entry into authenticated card screens (a stale flag can outlive the token).
 */
export const hasCardSession = (): boolean => hasSecret(ACCESS_TOKEN_SECRET_ID)

/** Removes the tokens from the keystore and resets the auth flag. */
export const clearCardSession = async (): Promise<void> => {
    await removeSecret(ACCESS_TOKEN_SECRET_ID)
    await removeSecret(REFRESH_TOKEN_SECRET_ID)
    useCardSessionStore.getState().resetState()
}

/**
 * Refresh handler invoked by the transport on a 401. Reads the refresh token
 * from the keystore and exchanges it (decoded only inside the `withSecret`
 * handler). Returns whether a usable session is now in place; on any failure
 * (including no refresh token — e.g. a registration-finalize session that
 * predates the OAuth exchange) it clears the session so the UI routes the
 * user back to login.
 */
export const refreshSession = async (): Promise<boolean> => {
    try {
        const { network } = useNetworkStore.getState()
        const tokens = await withSecret(REFRESH_TOKEN_SECRET_ID, bytes =>
            refreshTokenRequest({
                refreshToken: textDecoder.decode(bytes),
                network,
            }),
        )
        if (!tokens) {
            await clearCardSession()
            return false
        }
        await setCardSession(tokens)
        return true
    } catch (error) {
        logger.warn('Baanx session refresh failed', { error })
        await clearCardSession()
        return false
    }
}

// Register the refresh handler with the transport on module load (avoids a
// transport → session import cycle, and removes the need for an app-startup
// bootstrap that reads the keystore).
setRefreshHandler(refreshSession)
