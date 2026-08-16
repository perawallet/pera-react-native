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
    decode,
    MasterKeyNotFoundError,
    METADATA_PREFIX,
    readMasterKey,
    storage as keystoreStorage,
} from '@algorandfoundation/react-native-keystore'
import type { KeyData } from '@algorandfoundation/keystore-core'
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

/**
 * Kept in step with `HD_ROOT_SHADOW_TYPES` in the provider extension's
 * `preflight/0001-retire-hd-root-shadow`, which **deletes** these records'
 * bare-id copies once the split `k/`+`m/` pair is verifiably present. This
 * list is the authority — it decides which id the credential provider is
 * actually handed.
 */
const HD_ROOT_KEY_TYPES = new Set<string>([
    'hd-root-key',
    'xhd-root-key',
    'hd-seed',
    'seed',
])

/**
 * The deterministic-P256 main key's `metadata.scheme`. Restated rather than
 * imported from `@perawallet/wallet-extension-provider`'s `passkeyMainKeyId`
 * module for the same reason `HD_ROOT_KEY_TYPES` is — this file must stay clear
 * of that package's provider graph.
 */
const PASSKEY_MAIN_KEY_SCHEME = 'pbkdf2-p256'

/**
 * `storeDisabled` is the expected state when the user hasn't enabled Pera as
 * their AutoFill provider, not a fault. The distinct `ReactNativePasskeyAutofill`
 * code 1 ("App Group is not configured") IS a real bug, so it must not match.
 */
const isStoreDisabledError = (err: unknown): boolean =>
    err instanceof Error &&
    err.message.includes('ASCredentialIdentityStoreErrorDomain error 1')

let activeBootstrap: Promise<void> | null = null

/**
 * Bootstraps the native passkey autofill subsystem. Idempotent, and overlapping
 * calls coalesce into the first outstanding run.
 *
 * Reads MMKV rather than the reactive keystore store on purpose: that store
 * hydrates asynchronously, so it can be empty at cold start. MMKV is the
 * synchronous, always-current source of persisted keys.
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

        // Raw bytes, so no non-zeroable hex string is ever materialized in the
        // JS heap. The Buffer polyfill is copied into a genuine Uint8Array so
        // Expo's bridge marshals it to Swift Data / Kotlin ByteArray.
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

        await configureParentKey(service)

        await service
            .configureIntentActions(
                intentActions.getPasskeyAction,
                intentActions.createPasskeyAction,
            )
            .catch(err =>
                logger.error(err as Error, { step: 'configureIntentActions' }),
            )

        // Only meaningful when Pera is the active credential provider —
        // otherwise iOS rejects with `storeDisabled`, a benign expected state
        // that would otherwise surface as an error toast on every foreground.
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
 * The two derivation-parent candidates, from one pass over the plaintext `k/`
 * bucket. No material is decrypted and no biometric prompt is raised to answer
 * "which key is it".
 *
 * The main key must be found by a full scan rather than by taking the first
 * `hd-root-key`: it shares that type with the XHD root and is told apart only
 * by `metadata.scheme`.
 */
const findParentKeyCandidates = (): {
    mainKey: KeyData | null
    hdRoot: KeyData | null
} => {
    let scanned = 0
    let mainKey: KeyData | null = null
    let hdRoot: KeyData | null = null

    for (const key of keystoreStorage.getAllKeys()) {
        if (!key.startsWith(METADATA_PREFIX)) continue
        const raw = keystoreStorage.getString(key)
        if (!raw) continue
        scanned += 1
        let record: KeyData
        try {
            record = decode(raw) as KeyData
        } catch (err) {
            logger.warn('Skipping an unreadable keystore metadata entry', {
                step: 'findParentKeyCandidates',
                key,
                err: String(err),
            })
            continue
        }

        const scheme = (record.metadata as { scheme?: unknown } | undefined)
            ?.scheme
        if (
            record.type === 'hd-root-key' &&
            scheme === PASSKEY_MAIN_KEY_SCHEME
        ) {
            mainKey ??= record
            continue
        }
        if (HD_ROOT_KEY_TYPES.has(record.type)) hdRoot ??= record
    }

    if (!mainKey && !hdRoot) {
        logger.warn(
            scanned === 0
                ? 'Keystore MMKV is empty; passkey autofill has no HD root key to derive from'
                : 'No HD root key found in keystore; passkey autofill will not be able to derive credentials',
            { keyCount: scanned, lookingFor: Array.from(HD_ROOT_KEY_TYPES) },
        )
    }

    return { mainKey, hdRoot }
}

const configureParentKey = async (
    service: PasskeyAutofillService,
): Promise<void> => {
    const { mainKey, hdRoot } = findParentKeyCandidates()

    if (mainKey) {
        await service
            .setMainKeyId(mainKey.id)
            .catch(err => logger.error(err as Error, { step: 'setMainKeyId' }))
        return
    }

    if (!hdRoot) return

    // Deprecated upstream, but it is what a wallet with no main key yet still
    // derives from, and `selectParentKey` honours a credential's pinned scheme
    // either way.
    await service
        .setHdRootKeyId(hdRoot.id)
        .catch(err => logger.error(err as Error, { step: 'setHdRootKeyId' }))
}

/**
 * Resets the singleton lock. Test-only.
 */
export const __resetBootstrapForTests = (): void => {
    activeBootstrap = null
}
