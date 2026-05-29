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

import { registerGlobals } from 'react-native-webrtc'

export type CredentialMechanism = {
    get: (options: unknown) => Promise<unknown>
    create: (options: unknown) => Promise<unknown>
}

/**
 * Installs a minimal `navigator.credentials` shim onto the given global target,
 * delegating to the WebAuthn mechanism chosen in the Phase-0 device spike
 * (keystore-native P256 or react-native-passkey). Kept separate from
 * `registerGlobals` so it is unit testable without the native WebRTC module.
 */
export const installCredentialsPolyfill = (
    target: { navigator?: { credentials?: unknown } },
    mechanism: CredentialMechanism,
): void => {
    const navigatorTarget = (target.navigator ?? {}) as {
        credentials?: unknown
    }
    navigatorTarget.credentials = {
        get: (options: unknown) => mechanism.get(options),
        create: (options: unknown) => mechanism.create(options),
    }
    target.navigator = navigatorTarget
}

/**
 * One-time app-startup bootstrap: registers the react-native-webrtc globals
 * (RTCPeerConnection et al. that the vendored SignalClient expects) and installs
 * the credentials polyfill. Call once before any Liquid Auth connection.
 */
export const bootstrapLiquidAuth = (mechanism: CredentialMechanism): void => {
    registerGlobals()
    installCredentialsPolyfill(globalThis as never, mechanism)
}
