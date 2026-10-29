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
    networkTierForMode,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional, Nullable } from '@perawallet/wallet-core-shared'

export const INSTALL_KEY_DB_NAME = 'pera-integrity'

const STORE_NAME = 'keys'
const RECORD_KEY = 'install-key'

const KEY_PARAMS = { name: 'ECDSA', namedCurve: 'P-256' } as const
const SIGN_PARAMS = { name: 'ECDSA', hash: 'SHA-256' } as const

const openDatabase = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
        const request = indexedDB.open(INSTALL_KEY_DB_NAME, 1)
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME)
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () =>
            reject(request.error ?? new Error('indexedDB.open failed'))
    })

const withStore = async <T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
    const db = await openDatabase()
    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, mode)
            const request = fn(transaction.objectStore(STORE_NAME))
            request.onsuccess = () => resolve(request.result)
            request.onerror = () =>
                reject(request.error ?? new Error('IndexedDB request failed'))
        })
    } finally {
        db.close()
    }
}

const toBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
}

const toBase64Url = (buffer: ArrayBuffer): string =>
    toBase64(buffer).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export type EnrolmentMarker = {
    kid: string
    enrolledAt: string
}

// Per deployment: each has its own database, so an enrolment on one means
// nothing to the other. Keyed by the deployment's tier name, the key these
// records had while they were per network, so existing enrolments still match.
const enrolmentRecordKey = (deployment: WalletMode): string =>
    `enrolment:${networkTierForMode(deployment)}`

/**
 * The installation keypair, generated on first use. `extractable: false`
 * applies to the PRIVATE key only — the public half of an asymmetric pair is
 * always exportable, which is why exportInstallPublicKey below works.
 */
const loadOrGenerateInstallKey = async (): Promise<CryptoKeyPair> => {
    const stored = await withStore<Optional<CryptoKeyPair>>('readonly', store =>
        store.get(RECORD_KEY),
    )
    if (stored?.privateKey && stored?.publicKey) return stored

    const generated = await crypto.subtle.generateKey(KEY_PARAMS, false, [
        'sign',
        'verify',
    ])
    await withStore('readwrite', store => store.put(generated, RECORD_KEY))
    return generated
}

// Single-flight in-flight callers so mint()'s concurrent export+sign share ONE
// generation. Without this, on a fresh install both readonly reads miss the
// other's uncommitted write, each generates a rival keypair (last write wins),
// and the exported public key no longer matches the signing key. Cleared on
// settle so a failed generation stays retryable and clearInstallKey stays
// effective on the next call.
let inFlightInstallKey: Nullable<Promise<CryptoKeyPair>> = null

export const getOrCreateInstallKey = (): Promise<CryptoKeyPair> => {
    if (inFlightInstallKey) return inFlightInstallKey
    const pending = loadOrGenerateInstallKey()
    inFlightInstallKey = pending
    // Clear the memo on settle so a failed generation stays retryable. The
    // real caller (mint's Promise.all) handles rejection; this derived promise
    // must swallow it so a key-gen failure can't surface as an unhandled
    // rejection in the service worker.
    void pending
        .catch(() => undefined)
        .finally(() => {
            if (inFlightInstallKey === pending) inFlightInstallKey = null
        })
    return pending
}

export const exportInstallPublicKey = async (): Promise<string> => {
    const { publicKey } = await getOrCreateInstallKey()
    return toBase64(await crypto.subtle.exportKey('spki', publicKey))
}

/** base64url(sha256(SPKI DER)) of the install public key, unpadded: the kid enrolment binds. */
export const getInstallKeyId = async (): Promise<string> => {
    const { publicKey } = await getOrCreateInstallKey()
    const spki = await crypto.subtle.exportKey('spki', publicKey)
    return toBase64Url(await crypto.subtle.digest('SHA-256', spki))
}

export const getEnrolmentMarker = async (
    deployment: WalletMode,
): Promise<Nullable<EnrolmentMarker>> => {
    const stored = await withStore<unknown>('readonly', store =>
        store.get(enrolmentRecordKey(deployment)),
    )
    const marker = stored as Optional<Partial<EnrolmentMarker>>
    return typeof marker?.kid === 'string' &&
        typeof marker.enrolledAt === 'string'
        ? { kid: marker.kid, enrolledAt: marker.enrolledAt }
        : null
}

export const putEnrolmentMarker = async (
    deployment: WalletMode,
    marker: EnrolmentMarker,
): Promise<void> => {
    await withStore('readwrite', store =>
        store.put(marker, enrolmentRecordKey(deployment)),
    )
}

export const clearEnrolmentMarker = async (
    deployment: WalletMode,
): Promise<void> => {
    await withStore('readwrite', store =>
        store.delete(enrolmentRecordKey(deployment)),
    )
}

/**
 * Signs the backend's challenge string as UTF-8 bytes. The result is WebCrypto's
 * raw `r||s` (64 bytes for P-256), base64-encoded — NOT DER. The backend's
 * verifier must expect the same encoding.
 */
export const signChallenge = async (challenge: string): Promise<string> => {
    const { privateKey } = await getOrCreateInstallKey()
    const signature = await crypto.subtle.sign(
        SIGN_PARAMS,
        privateKey,
        new TextEncoder().encode(challenge),
    )
    return toBase64(signature)
}

export const clearInstallKey = async (): Promise<void> => {
    await withStore('readwrite', store => store.delete(RECORD_KEY))
}
