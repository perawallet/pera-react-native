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

/**
 * The installation keypair, generated on first use. `extractable: false`
 * applies to the PRIVATE key only — the public half of an asymmetric pair is
 * always exportable, which is why exportInstallPublicKey below works.
 */
const loadOrGenerateInstallKey = async (): Promise<CryptoKeyPair> => {
    const stored = await withStore<CryptoKeyPair | undefined>(
        'readonly',
        store => store.get(RECORD_KEY),
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
let inFlightInstallKey: Promise<CryptoKeyPair> | null = null

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
