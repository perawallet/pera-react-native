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

export const name = '@perawallet/wallet-core-passkeys'

export * from './models'
export * from './hooks'
export * from './bootstrap'
// The Android credential provider's on-disk contract. Exported because
// `packages/migrate` writes records the provider must be able to read, and
// phase 3 (below) reads them back to migrate them into `k/`+`m/`.
export * from './native/nativeProviderRecord'
export * from './errors'
export * from './authenticator/authenticator'
export * from './authenticator/wire'
// `splitP256PublicKey` is the XY-splitter; the authenticator core only
// re-exports its own consumers of it (`p256XYToSpkiDer`, `deriveCredentialId`).
// The keystore-chrome adapter needs the raw splitter itself to normalize
// whatever the keystore hands back as `key.publicKey` into the flat XY form
// the `KeystoreSigner` port returns.
export {
    splitP256PublicKey,
    type P256PublicKeyXY,
} from './authenticator/webauthn-structures'

// Re-export key extension types so callers can depend on
// `@perawallet/wallet-core-passkeys` exclusively.
export type {
    NativeStoredCredential,
    PasskeyAutofillEventCallback,
    PasskeyAutofillExtension,
    PasskeyAutofillService,
    PasskeyAutofillSubscription,
} from '@perawallet/wallet-extension-passkey-autofill'
