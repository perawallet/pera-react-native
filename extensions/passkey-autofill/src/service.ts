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

import { Platform } from 'react-native'
import type {
    NativeStoredCredential,
    PasskeyAutofillEventCallback,
    PasskeyAutofillSubscription,
} from './types'

/**
 * Subset of the `@algorandfoundation/react-native-passkey-autofill` native
 * module surface that the service consumes. Declared as a structural type so
 * tests can inject a mock without depending on the native module at all.
 *
 * The native surface is **platform-dependent**: several methods
 * (`getStoredCredentials`, `refreshCredentialIdentities`,
 * `replaceCredentialIdentities`, `setDerivedMainKey`, `getDiagnostics`) are
 * implemented on iOS only — on Android the credential provider reads MMKV
 * directly so they're simply not registered. Every call therefore goes
 * through {@link PasskeyAutofillService.invoke} which no-ops when the method
 * is absent rather than throwing `undefined is not a function`.
 */
export interface PasskeyAutofillNativeAPI {
    setMasterKey(secret: Uint8Array): Promise<void>
    setHdRootKeyId(id: string): Promise<void>
    getHdRootKeyId?(): Promise<string | null>
    setDerivedMainKey?(hex: string): Promise<void>
    configureIntentActions(get: string, create: string): Promise<void>
    clearCredentials(): Promise<void>
    deleteCredential(credentialId: string): Promise<void>
    getStoredCredentials?(): Promise<NativeStoredCredential[]>
    refreshCredentialIdentities?(): Promise<void>
    replaceCredentialIdentities?(
        credentials: NativeStoredCredential[],
    ): Promise<void>
    isProviderActive(): Promise<boolean>
    openProviderSettings(): Promise<boolean>
    getDiagnostics?(): Promise<string[]>
    addListener(
        eventName: string,
        cb: PasskeyAutofillEventCallback,
    ): { remove: () => void }
}

/**
 * Typed, platform-aware wrapper around the passkey autofill native module.
 *
 * Owns no application state — it is a stateless façade. The wallet provider
 * holds a single instance and exposes it as `provider.passkeyAutofill`.
 */
export class PasskeyAutofillService {
    constructor(private readonly native: PasskeyAutofillNativeAPI) {}

    /**
     * Invokes a native method by name. If the method isn't present on the
     * current platform's native module, resolves to `fallback` instead of
     * throwing. Wrapping the call in an async IIFE also converts any
     * synchronous throw from the Expo bridge into a promise rejection the
     * caller's `.catch` can handle.
     */
    private invoke<T>(
        method: keyof PasskeyAutofillNativeAPI,
        args: unknown[],
        fallback: T,
    ): Promise<T> {
        const fn = this.native[method] as
            | ((...a: unknown[]) => T | Promise<T>)
            | undefined
        if (typeof fn !== 'function') {
            return Promise.resolve(fallback)
        }
        return (async () => fn.apply(this.native, args))()
    }

    setMasterKey(secret: Uint8Array): Promise<void> {
        // Raw bytes cross the bridge (upstream `setMasterKey` takes a
        // `Uint8Array`) so a non-zeroable hex string is never materialized.
        return this.invoke('setMasterKey', [secret], undefined)
    }

    setHdRootKeyId(id: string): Promise<void> {
        return this.invoke('setHdRootKeyId', [id], undefined)
    }

    /**
     * Reads the same slot {@link setHdRootKeyId} writes — the one probe that
     * can tell whether the native side still holds a parent id at all.
     */
    getHdRootKeyId(): Promise<string | null> {
        return this.invoke<string | null>('getHdRootKeyId', [], null)
    }

    /**
     * Whether the underlying native module actually implements
     * `setDerivedMainKey`. Lets callers avoid even *building* the derived-key
     * hex string (a secret) when nothing on the native side would consume it —
     * the method is absent on current iOS/Android builds, so the string would
     * otherwise be materialized only to be discarded by a no-op.
     */
    get supportsDerivedMainKey(): boolean {
        return typeof this.native.setDerivedMainKey === 'function'
    }

    /**
     * Forward-compatible. Newer canary builds of the autofill module expose
     * `setDerivedMainKey` so the native side can derive credentials without
     * round-tripping through the keystore on every assertion. Older builds
     * (and Android) derive on demand, so this no-ops when absent — guard the
     * call with {@link supportsDerivedMainKey} to skip stringifying the secret.
     */
    setDerivedMainKey(hex: string): Promise<void> {
        return this.invoke('setDerivedMainKey', [normalizeHex(hex)], undefined)
    }

    /**
     * Android-only. On iOS the system Credential Provider Extension is wired
     * through entitlements rather than intent actions, so this no-ops.
     */
    configureIntentActions(
        getAction: string,
        createAction: string,
    ): Promise<void> {
        if (Platform.OS !== 'android') return Promise.resolve()
        return this.invoke(
            'configureIntentActions',
            [getAction, createAction],
            undefined,
        )
    }

    clearCredentials(): Promise<void> {
        return this.invoke('clearCredentials', [], undefined)
    }

    deleteCredential(credentialId: string): Promise<void> {
        return this.invoke('deleteCredential', [credentialId], undefined)
    }

    getStoredCredentials(): Promise<NativeStoredCredential[]> {
        return this.invoke<NativeStoredCredential[]>(
            'getStoredCredentials',
            [],
            [],
        )
    }

    /** iOS-only — no-ops on Android, where the provider reads MMKV directly. */
    refreshCredentialIdentities(): Promise<void> {
        return this.invoke('refreshCredentialIdentities', [], undefined)
    }

    isProviderActive(): Promise<boolean> {
        return this.invoke('isProviderActive', [], false)
    }

    openProviderSettings(): Promise<boolean> {
        return this.invoke('openProviderSettings', [], false)
    }

    onPasskeyAdded(
        cb: PasskeyAutofillEventCallback,
    ): PasskeyAutofillSubscription {
        return this.subscribe('onPasskeyAdded', cb)
    }

    onPasskeyAuthenticated(
        cb: PasskeyAutofillEventCallback,
    ): PasskeyAutofillSubscription {
        return this.subscribe('onPasskeyAuthenticated', cb)
    }

    private subscribe(
        eventName: string,
        cb: PasskeyAutofillEventCallback,
    ): PasskeyAutofillSubscription {
        if (typeof this.native.addListener !== 'function') {
            return { remove: () => undefined }
        }
        return this.native.addListener(eventName, cb)
    }
}

const normalizeHex = (input: string): string => {
    const hasEdgeWhitespace =
        input.length > 0 && (/^\s/.test(input) || /\s$/.test(input))
    const hasPrefix = input.startsWith('0x') || input.startsWith('0X')
    // Already-clean hex (the only form internally generated for secret
    // material) is returned untouched. `.trim()`/`.slice()` each allocate a
    // fresh, immutable copy of the secret that lingers in memory until GC, so
    // we avoid them unless the input genuinely needs normalizing.
    if (!hasEdgeWhitespace && !hasPrefix) return input
    const trimmed = hasEdgeWhitespace ? input.trim() : input
    return trimmed.startsWith('0x') || trimmed.startsWith('0X')
        ? trimmed.slice(2)
        : trimmed
}
