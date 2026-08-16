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

import { useMemo, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Key } from '@algorandfoundation/keystore-core'
import { logger } from '@perawallet/wallet-core-shared'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import type { NativeStoredCredential } from '@perawallet/wallet-extension-passkey-autofill'
import {
    credentialToPasskey,
    isPasskeyKey,
    keyToPasskey,
    type Passkey,
} from '../models/passkey'
import { usePasskeyAutofillService } from './usePasskeyAutofillService'

const KEYSTORE_KEYS_SNAPSHOT_SUBSCRIBE = (
    listener: () => void,
): (() => void) => {
    const sub = getKeystoreStore().subscribe(listener)
    return () => sub.unsubscribe()
}

const getKeystoreKeysSnapshot = (): Key[] => getKeystoreStore().state.keys

/**
 * Prefix shared by every passkey query, including ones owned by consumers
 * (the mobile migration banner keeps its own sibling key under it). Mutations
 * invalidate the root so those siblings refresh too — TanStack matches by
 * prefix, and a sibling is not a descendant of `passkeysQueryKey`.
 */
export const passkeysQueryKeyRoot = ['passkeys'] as const

export const passkeysQueryKey = [
    ...passkeysQueryKeyRoot,
    'native-credentials',
] as const

export type UsePasskeysQueryResult = {
    passkeys: Passkey[]
    isLoading: boolean
    isError: boolean
    error: Error | null
    refetch: () => void
}

/**
 * Projects the union of:
 * - Keystore-backed passkey rows (filtered by P256-derived key type), and
 * - Native autofill credentials that have not yet reconciled into the keystore.
 *
 * Keystore-backed rows take precedence by url-safe credentialId. Re-renders
 * whenever the keystore reactive store changes or the native credential list
 * is refetched.
 */
export const usePasskeysQuery = (): UsePasskeysQueryResult => {
    const service = usePasskeyAutofillService()

    const keystoreKeys = useSyncExternalStore(
        KEYSTORE_KEYS_SNAPSHOT_SUBSCRIBE,
        getKeystoreKeysSnapshot,
        getKeystoreKeysSnapshot,
    )

    const nativeQuery = useQuery({
        queryKey: passkeysQueryKey,
        queryFn: async (): Promise<NativeStoredCredential[]> => {
            try {
                return await service.getStoredCredentials()
            } catch (err) {
                // The native module can throw before the autofill bootstrap
                // has set a master key, when the platform doesn't yet have a
                // credential identity store, or on unsupported OS versions.
                // Treat as "no native credentials" — keystore-backed passkeys
                // still surface via the keystore projection.
                logger.warn('getStoredCredentials failed', { error: err })
                return []
            }
        },
        staleTime: 30_000,
    })

    const passkeys = useMemo(
        () => mergePasskeys(keystoreKeys, nativeQuery.data ?? []),
        [keystoreKeys, nativeQuery.data],
    )

    return {
        passkeys,
        isLoading: nativeQuery.isLoading,
        isError: nativeQuery.isError,
        error: nativeQuery.error as Error | null,
        refetch: () => void nativeQuery.refetch(),
    }
}

const mergePasskeys = (
    keys: Key[],
    native: NativeStoredCredential[],
): Passkey[] => {
    const byId = new Map<string, Passkey>()

    for (const k of keys) {
        if (!isPasskeyKey(k)) continue
        const projected = keyToPasskey(k)
        if (projected) byId.set(projected.id, projected)
    }

    for (const c of native) {
        const projected = credentialToPasskey(c)
        if (!projected) continue
        if (!byId.has(projected.id)) byId.set(projected.id, projected)
    }

    return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt)
}
