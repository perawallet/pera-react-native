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
    fetchSecret,
    MasterKeyNotFoundError,
    readMasterKey,
    storage as keystoreStorage,
} from '@algorandfoundation/react-native-keystore'
import type { KeyData } from '@algorandfoundation/keystore'
import { logger } from '@perawallet/wallet-core-shared'
import type { PasskeyAutofillService } from '@perawallet/wallet-extension-passkey-autofill'

export interface BootstrapPasskeyAutofillOptions {
    /** Required. The service registered on the provider. */
    service: PasskeyAutofillService
    /**
     * Android-only intent action ids matching the values declared in the
     * autofill Expo plugin / AndroidManifest.xml.
     */
    intentActions: {
        getPasskeyAction: string
        createPasskeyAction: string
    }
}

const HD_ROOT_KEY_TYPES = new Set<string>([
    'hd-root-key',
    'xhd-root-key',
    'hd-seed',
    'seed',
])

/**
 * iOS reports a disabled AutoFill credential store as
 * `ASCredentialIdentityStoreError.storeDisabled` — domain
 * `ASCredentialIdentityStoreErrorDomain`, code 1. This is the expected state
 * when the user hasn't enabled Pera as their AutoFill provider, not a fault.
 * Note the distinct `ReactNativePasskeyAutofill` domain code 1 ("App Group is
 * not configured") is a real bug and intentionally does NOT match here.
 */
const isStoreDisabledError = (err: unknown): boolean =>
    err instanceof Error &&
    err.message.includes('ASCredentialIdentityStoreErrorDomain error 1')

let activeBootstrap: Promise<void> | null = null

/**
 * Bootstraps the native passkey autofill subsystem.
 *
 * Steps (idempotent):
 *  1. Fetch the master key (keychain-backed; no biometric prompt if already
 *     created during hydrateKeystore).
 *  2. Push the master key bytes to the native side.
 *  3. Find the HD root key by reading the keystore's MMKV namespace directly
 *     (the same source the native module uses) and push its id — plus, on
 *     builds that support it, its derived bytes — to the native side.
 *  4. Configure Android intent actions (no-op on iOS).
 *  5. Refresh the iOS Autofill identity store (no-op on Android).
 *
 * Reads from MMKV rather than the reactive keystore store on purpose: the
 * reactive store is hydrated asynchronously (and only via `commit` during a
 * session), so it can be empty when this runs at cold start. MMKV is the
 * synchronous, always-current source of persisted keys.
 *
 * Safe to call multiple times — overlapping calls coalesce into the first
 * outstanding run.
 */
export const bootstrapPasskeyAutofill = (
    options: BootstrapPasskeyAutofillOptions,
): Promise<void> => {
    if (activeBootstrap) return activeBootstrap

    activeBootstrap = runBootstrap(options).finally(() => {
        activeBootstrap = null
    })
    return activeBootstrap
}

const runBootstrap = async (
    options: BootstrapPasskeyAutofillOptions,
): Promise<void> => {
    const { service, intentActions } = options

    let masterKey: Buffer | null = null
    try {
        try {
            masterKey = await readMasterKey()
        } catch (err) {
            // A missing master key means the user hasn't created or restored a
            // wallet yet — there is no credential to publish, and the bootstrap
            // re-runs on the next launch. That's a precondition, not a fault,
            // so it stays off the crash reporter. Scoped to this call: the same
            // error from anywhere downstream is unexpected and still reported.
            if (err instanceof MasterKeyNotFoundError) {
                logger.warn(
                    'No master key yet; skipping passkey autofill bootstrap',
                    { step: 'bootstrapPasskeyAutofill' },
                )
                return
            }
            throw err
        }

        // Push the master key to the native side as raw bytes — the upstream
        // bridge takes a `Uint8Array`, so a non-zeroable hex string is never
        // materialized in the JS heap. Copy the (craftzdog) Buffer polyfill into
        // a genuine Uint8Array so Expo's typed-array bridge marshals it to Swift
        // Data / Kotlin ByteArray; wipe the copy after.
        const masterKeyBytes = Uint8Array.from(masterKey)
        try {
            await service
                .setMasterKey(masterKeyBytes)
                .catch(err =>
                    logger.error(err as Error, { step: 'setMasterKey' }),
                )
        } finally {
            masterKeyBytes.fill(0)
        }

        await configureHdRootKey(service, masterKey)

        await service
            .configureIntentActions(
                intentActions.getPasskeyAction,
                intentActions.createPasskeyAction,
            )
            .catch(err =>
                logger.error(err as Error, { step: 'configureIntentActions' }),
            )

        // Refreshing the iOS AutoFill identity store only makes sense when
        // Pera is the active credential provider. When the user hasn't enabled
        // it (the default), the store is disabled and iOS rejects with
        // ASCredentialIdentityStoreError.storeDisabled — a benign, expected
        // state, not a fault. Gating on isProviderActive() keeps that from
        // surfacing as an error toast on every launch/foreground, and skips an
        // unnecessary native round-trip. (No-op on Android, where
        // isProviderActive resolves false.)
        const providerActive = await service
            .isProviderActive()
            .catch(() => false)

        if (providerActive) {
            await service.refreshCredentialIdentities().catch(err => {
                // Tolerate the check→enable race: the store may have been
                // disabled between getState() and the write. A genuinely
                // different failure (e.g. App Group misconfiguration, a
                // different error domain) still surfaces as an error.
                if (isStoreDisabledError(err)) {
                    logger.warn(
                        'AutoFill identity store disabled; skipping refresh',
                        { step: 'refreshCredentialIdentities' },
                    )
                    return
                }
                logger.error(err as Error, {
                    step: 'refreshCredentialIdentities',
                })
            })
        }
    } catch (err) {
        // Surface the actual error object (with stack) instead of string-
        // interpolating it — `${err}` discards the stack and leaves the
        // caller staring at a bare "TypeError: undefined is not a function".
        logger.error(err as Error, { step: 'bootstrapPasskeyAutofill' })
    } finally {
        if (masterKey) masterKey.fill(0)
    }
}

/**
 * Locates the HD root key in the keystore MMKV namespace, hands its id to the
 * native side, and (on supported builds) pushes its derived private bytes.
 * Decrypts every entry's metadata to find the seed — mirrors `hydrateKeystore`
 * but scoped to the single key the autofill subsystem needs.
 */
const configureHdRootKey = async (
    service: PasskeyAutofillService,
    masterKey: Buffer,
): Promise<void> => {
    const keyIds = keystoreStorage.getAllKeys()
    if (keyIds.length === 0) {
        logger.warn(
            'Keystore MMKV is empty; passkey autofill has no HD root key to derive from',
        )
        return
    }

    // `fetchSecret` zeroes the master-key buffer it's given, so pass a fresh
    // copy per call.
    const secrets = await Promise.all(
        keyIds.map(keyId =>
            fetchSecret<KeyData>({
                keyId,
                options: { masterKey: Buffer.from(masterKey) },
            }).catch(() => null),
        ),
    )

    try {
        const hdRootSecret = secrets.find(
            (s): s is KeyData => s !== null && HD_ROOT_KEY_TYPES.has(s.type),
        )

        if (!hdRootSecret) {
            logger.warn(
                'No HD root key found in keystore; passkey autofill will not be able to derive credentials',
                {
                    keyCount: keyIds.length,
                    keyTypes: secrets.map(s => s?.type ?? 'undecryptable'),
                    lookingFor: Array.from(HD_ROOT_KEY_TYPES),
                },
            )
            return
        }

        await service
            .setHdRootKeyId(hdRootSecret.id)
            .catch(err =>
                logger.error(err as Error, { step: 'setHdRootKeyId' }),
            )

        // Only build the derived private-key hex string when the native side
        // actually implements setDerivedMainKey. On current iOS/Android builds
        // it doesn't, so this skips materializing a non-zeroable secret string
        // for a call that would no-op anyway. Lights up automatically on builds
        // that add native support.
        if (hdRootSecret.privateKey && service.supportsDerivedMainKey) {
            const pk = hdRootSecret.privateKey
            // Read the hex off a Buffer *view* over the secret's existing bytes
            // rather than `Buffer.from(pk)`, which would allocate a second copy
            // of the private key that nothing zeroes (the finally below only
            // wipes the original). The view shares the original's backing
            // store, so that single wipe covers it.
            const derived =
                pk instanceof Uint8Array
                    ? Buffer.from(pk.buffer, pk.byteOffset, pk.byteLength)
                    : Buffer.from(pk)
            await service
                .setDerivedMainKey(derived.toString('hex'))
                .catch(err =>
                    logger.error(err as Error, { step: 'setDerivedMainKey' }),
                )
        }
    } finally {
        // Zero every decrypted private key we pulled into memory.
        for (const secret of secrets) {
            if (secret?.privateKey instanceof Uint8Array) {
                secret.privateKey.fill(0)
            }
        }
    }
}

/**
 * Resets the singleton lock. Test-only.
 */
export const __resetBootstrapForTests = (): void => {
    activeBootstrap = null
}
