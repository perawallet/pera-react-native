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

import { createKeystoreCredentialMechanism } from '@perawallet/wallet-extension-liquid-auth'

import type { CredentialMechanism } from '@perawallet/wallet-extension-liquid-auth'

/**
 * Creates the in-app credential mechanism backed by the extension's keystore
 * adapter. Better UX, but NOT strictly FIDO-compliant.
 *
 * Thin re-export so both modes sit side-by-side behind the same seam; deleting
 * in-app mode means removing this file, the matching branch in
 * `selectCredentialMechanism.ts`, and the extension's keystore adapter +
 * webauthn/.
 */
export const createInAppCredentialMechanism = (): CredentialMechanism =>
    createKeystoreCredentialMechanism()
