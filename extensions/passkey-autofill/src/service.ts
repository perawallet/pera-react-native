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
    PasswordCredentialIdentity,
} from './types'

/**
 * Subset of the `@algorandfoundation/react-native-passkey-autofill` native
 * module surface that the service consumes. Declared as a structural type so
 * tests can inject a mock without depending on the native module at all.
 *
 * The native surface is **platform-dependent**: several methods
 * (`getStoredCredentials`, `refreshCredentialIdentities`,
 * `replaceCredentialIdentities`, `getDiagnostics`) are
 * implemented on iOS only — on Android the credential provider reads MMKV
 * directly so they're simply not registered. Every call therefore goes
 * through {@link PasskeyAutofillService.invoke} which no-ops when the method
 * is absent rather than throwing `undefined is not a function`.
 */
export interface PasskeyAutofillNativeAPI {
    setMasterKey(secret: Uint8Array): Promise<void>
    setMainKeyId(id: string): Promise<void>
    getMainKeyId?(): Promise<string | null>
    /** @deprecated use {@link PasskeyAutofillNativeAPI.setMainKeyId} */
    setHdRootKeyId(id: string): Promise<void>
    /** @deprecated use {@link PasskeyAutofillNativeAPI.getMainKeyId} */
    getHdRootKeyId?(): Promise<string | null>
    configureIntentActions(get: string, create: string): Promise<void>
    clearCredentials(): Promise<void>
    deleteCredential(credentialId: string): Promise<void>
    getStoredCredentials?(): Promise<NativeStoredCredential[]>
    refreshCredentialIdentities?(): Promise<void>
    replaceCredentialIdentities?(
        credentials: NativeStoredCredential[],
    ): Promise<void>
    replacePasswordCredentialIdentities?(
        identities: PasswordCredentialIdentity[],
    ): Promise<void>
    isProviderActive(): Promise<boolean>
    openProviderSettings(): Promise<boolean>
    isAutofillServiceActive?(): Promise<boolean>
    openAutofillSettings?(): Promise<boolean>
    autofillPickerReady?(): Promise<void>
    requestAutofillUnlock?(): Promise<boolean>
    resolveAutofillPick?(recordIdentifier: string): Promise<void>
    cancelAutofillPick?(): Promise<void>
    pruneAppLinks?(recordIdentifier: string): Promise<void>
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

    /**
     * Points the credential providers at the deterministic-P256 main key. An
     * id, never a secret: both providers read the material themselves out of
     * the shared keystore.
     */
    setMainKeyId(id: string): Promise<void> {
        return this.invoke('setMainKeyId', [id], undefined)
    }

    getMainKeyId(): Promise<string | null> {
        return this.invoke<string | null>('getMainKeyId', [], null)
    }

    /**
     * Deprecated upstream in favour of {@link setMainKeyId}, and on iOS
     * canary.24 both land in the same `defaultMainKeyIdKey` slot
     * (`ReactNativePasskeyAutofillModule.swift:41`/`:61` → `saveMainKeyId`) —
     * so this is for a wallet that has no main key yet, not a second slot to
     * fill alongside one.
     */
    setHdRootKeyId(id: string): Promise<void> {
        return this.invoke('setHdRootKeyId', [id], undefined)
    }

    /**
     * Reads the same slot {@link setHdRootKeyId} writes. Unlike
     * {@link getMainKeyId} this getter exists on every shipped native build,
     * so it is the one probe that can tell whether the native side still
     * holds a parent id at all.
     */
    getHdRootKeyId(): Promise<string | null> {
        return this.invoke<string | null>('getHdRootKeyId', [], null)
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

    /**
     * iOS-only. Android's credential provider enumerates MMKV on demand and
     * keeps no OS-side index, so there is nothing to replace there.
     */
    replacePasswordCredentialIdentities(
        identities: PasswordCredentialIdentity[],
    ): Promise<void> {
        return this.invoke(
            'replacePasswordCredentialIdentities',
            [identities],
            undefined,
        )
    }

    isProviderActive(): Promise<boolean> {
        return this.invoke('isProviderActive', [], false)
    }

    openProviderSettings(): Promise<boolean> {
        return this.invoke('openProviderSettings', [], false)
    }

    /**
     * Unlike other optional native methods, an absent
     * `isAutofillServiceActive` must reject rather than resolve `false` via
     * {@link invoke}'s fallback: "no autofill service exists on this
     * platform" (iOS, or a build predating the native work) has to be
     * distinguishable from "the service exists and is off", since only the
     * latter is something the enable-action UI can fix.
     */
    isAutofillServiceActive(): Promise<boolean> {
        if (typeof this.native.isAutofillServiceActive !== 'function') {
            return Promise.reject(
                new Error('isAutofillServiceActive is not supported'),
            )
        }
        return (async () => this.native.isAutofillServiceActive!())()
    }

    openAutofillSettings(): Promise<boolean> {
        return this.invoke('openAutofillSettings', [], false)
    }

    autofillPickerReady(): Promise<void> {
        return this.invoke('autofillPickerReady', [], undefined)
    }

    requestAutofillUnlock(): Promise<boolean> {
        return this.invoke('requestAutofillUnlock', [], false)
    }

    resolveAutofillPick(recordIdentifier: string): Promise<void> {
        return this.invoke('resolveAutofillPick', [recordIdentifier], undefined)
    }

    cancelAutofillPick(): Promise<void> {
        return this.invoke('cancelAutofillPick', [], undefined)
    }

    pruneAppLinks(recordIdentifier: string): Promise<void> {
        return this.invoke('pruneAppLinks', [recordIdentifier], undefined)
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
