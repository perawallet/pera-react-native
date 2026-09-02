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
 * The deterministic-P256 main key's `metadata.scheme`, restated rather than
 * imported from `@perawallet/wallet-extension-provider`: this file's imports
 * are keystore-level only, and drift between the two copies is pinned on both
 * sides (`bootstrapPasskeyAutofill.spec.ts`, `0003-mint-passkey-main-key.spec.ts`).
 */
const PASSKEY_MAIN_KEY_SCHEME = 'pbkdf2-p256'

/**
 * `storeDisabled` is the expected state when the user hasn't enabled Pera as
 * their AutoFill provider, not a fault. The distinct `ReactNativePasskeyAutofill`
 * code 1 ("App Group is not configured") IS a real bug, so it must not match.
 * Exported for every caller of an identity-store-writing native method
 * (`refreshCredentialIdentities`, `clearCredentials`) that must not report
 * the disabled state as an error.
 */
export const isStoreDisabledError = (err: unknown): boolean =>
    err instanceof Error &&
    err.message.includes('ASCredentialIdentityStoreErrorDomain error 1')

/**
 * `instanceof` alone is not reliable across the package boundary: the error is
 * constructed inside the keystore package, and a duplicated copy of that package
 * under Metro puts the class in a different module instance, so the check
 * silently fails and a benign missing key gets reported to Crashlytics as an
 * error. `MasterKeyNotFoundError` sets `name` in its constructor, so matching on
 * it is a sound fallback — the same belt-and-braces ky uses for its own guards.
 */
const isMasterKeyNotFoundError = (err: unknown): boolean =>
    err instanceof MasterKeyNotFoundError ||
    (err instanceof Error && err.name === 'MasterKeyNotFoundError')

/**
 * `skipped`: no wallet yet, nothing to publish. `failed`: a native step
 * rejected and the remaining steps were NOT applied — the native side is at
 * most a prefix of the intended configuration, never a mix of old and new.
 */
export type PasskeyBootstrapOutcome = 'ready' | 'skipped' | 'failed'

// Thrown by `abortStep` after the failing step has been logged with its own
// `step` context; the outer catch recognises it and must not log twice.
const BOOTSTRAP_ABORT = Symbol('passkey-bootstrap-abort')

const abortStep = (step: string, err: unknown): never => {
    logger.error(err as Error, { step })
    throw BOOTSTRAP_ABORT
}

let activeBootstrap: Promise<PasskeyBootstrapOutcome> | null = null

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
): Promise<PasskeyBootstrapOutcome> => {
    if (activeBootstrap) return activeBootstrap

    activeBootstrap = runBootstrap(options).finally(() => {
        activeBootstrap = null
    })
    return activeBootstrap
}

const runBootstrap = async (
    options: BootstrapPasskeyAutofillOptions,
): Promise<PasskeyBootstrapOutcome> => {
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
            if (isMasterKeyNotFoundError(err)) {
                logger.warn(
                    'No master key yet; skipping passkey autofill bootstrap',
                    { step: 'bootstrapPasskeyAutofill' },
                )
                return 'skipped'
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
                .catch(err => abortStep('setMasterKey', err))
        } finally {
            masterKeyBytes.fill(0)
        }

        await configureParentKey(service)

        await service
            .configureIntentActions(
                intentActions.getPasskeyAction,
                intentActions.createPasskeyAction,
            )
            .catch(err => abortStep('configureIntentActions', err))

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
                abortStep('refreshCredentialIdentities', err)
            })
        }

        return 'ready'
    } catch (err) {
        if (err !== BOOTSTRAP_ABORT) {
            // Surface the actual error object (with stack) instead of string-
            // interpolating it — `${err}` discards the stack and leaves the
            // caller staring at a bare "TypeError: undefined is not a function".
            logger.error(err as Error, { step: 'bootstrapPasskeyAutofill' })
        }
        return 'failed'
    } finally {
        if (masterKey) masterKey.fill(0)
    }
}

// Code-unit order, deliberately locale-independent: the pick must be the same
// on every launch and every device.
const byId = (a: KeyData, b: KeyData): number =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/**
 * Every derivation-parent candidate, from one pass over the plaintext `k/`
 * bucket. No material is decrypted and no biometric prompt is raised to answer
 * "which key is it".
 *
 * The main key must be found by a full scan rather than by taking the first
 * `hd-root-key`: it shares that type with the XHD root and is told apart only
 * by `metadata.scheme`. Both lists come back sorted by id because MMKV's
 * `getAllKeys` order is arbitrary — without the sort, which root wins a tie
 * would silently change between launches.
 */
const findParentKeyCandidates = (): {
    mainKeys: KeyData[]
    hdRoots: KeyData[]
} => {
    let scanned = 0
    const mainKeys: KeyData[] = []
    const hdRoots: KeyData[] = []

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
            mainKeys.push(record)
            continue
        }
        if (HD_ROOT_KEY_TYPES.has(record.type)) hdRoots.push(record)
    }

    if (mainKeys.length === 0 && hdRoots.length === 0) {
        logger.warn(
            scanned === 0
                ? 'Keystore MMKV is empty; passkey autofill has no HD root key to derive from'
                : 'No HD root key found in keystore; passkey autofill will not be able to derive credentials',
            { keyCount: scanned, lookingFor: Array.from(HD_ROOT_KEY_TYPES) },
        )
    }

    return { mainKeys: mainKeys.sort(byId), hdRoots: hdRoots.sort(byId) }
}

const configureParentKey = async (
    service: PasskeyAutofillService,
): Promise<void> => {
    const { mainKeys, hdRoots } = findParentKeyCandidates()

    if (mainKeys.length > 0) {
        if (mainKeys.length > 1) {
            // The dp256 main key is a device-wide singleton (`usePasskeyMainKey`
            // short-circuits on it; repair 0003 mints at most one). A second one
            // is an invariant violation worth a crash report, but not worth
            // killing autofill over — the deterministic pick keeps it alive.
            logger.error(
                new Error(
                    `Expected one passkey main key, found ${mainKeys.length}: ${mainKeys
                        .map(k => k.id)
                        .join(', ')}`,
                ),
                { step: 'configureParentKey' },
            )
        }
        await service
            .setMainKeyId(mainKeys[0].id)
            .catch(err => abortStep('setMainKeyId', err))
        return
    }

    if (hdRoots.length > 0) {
        if (hdRoots.length > 1) {
            // Legitimate for a multi-wallet user whose main key hasn't been
            // minted yet; the id-sorted pick is stable but still arbitrary.
            logger.warn(
                `Multiple HD roots and no passkey main key; wiring ${hdRoots[0].id} of ${hdRoots.length} candidates`,
                { step: 'configureParentKey' },
            )
        }
        // Deprecated upstream, but it is what a wallet with no main key yet
        // still derives from, and `selectParentKey` honours a credential's
        // pinned scheme either way.
        await service
            .setHdRootKeyId(hdRoots[0].id)
            .catch(err => abortStep('setHdRootKeyId', err))
        return
    }

    // No local root, but the native side may still point at one from a
    // previous wallet. `''` never resolves to a key, so both providers fail
    // closed instead of deriving from a parent this keystore no longer holds.
    // Only the pointer is invalidated — stored credentials are not touched,
    // so a transient scan miss cannot destroy them.
    const staleId = await service.getHdRootKeyId().catch(() => null)
    if (staleId) {
        logger.warn(
            'Keystore has no HD root but native still holds a parent key id; invalidating it',
            { step: 'configureParentKey' },
        )
        await service
            .setHdRootKeyId('')
            .catch(err => abortStep('setHdRootKeyId', err))
    }
}

/**
 * Resets the singleton lock. Test-only.
 */
export const __resetBootstrapForTests = (): void => {
    activeBootstrap = null
}
