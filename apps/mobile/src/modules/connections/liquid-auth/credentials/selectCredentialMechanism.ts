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

import { createInAppCredentialMechanism } from './inAppMechanism'
import { createOsPasskeyCredentialMechanism } from './osPasskeyMechanism'

import type { CredentialMechanism } from '@perawallet/wallet-extension-liquid-auth'

/**
 * Toggle point between the two Liquid Auth WebAuthn ceremony implementations.
 *
 * To remove a mode, delete its mechanism file + the corresponding branch here
 * (and, for OS mode, the react-native-passkey dep/stub; for in-app mode, the
 * extension's keystore adapter + webauthn/).
 */
export const selectLiquidAuthCredentialMechanism = (
    useInApp: boolean,
): CredentialMechanism =>
    useInApp
        ? createInAppCredentialMechanism()
        : createOsPasskeyCredentialMechanism()
