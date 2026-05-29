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

import { Passkey } from 'react-native-passkey'

import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

import type { CredentialMechanism } from '@perawallet/wallet-extension-liquid-auth'

/**
 * The server seeds the WebAuthn user from the Algorand address we register
 * with, so the OS passkey prompt (and the saved passkey label) would otherwise
 * show a full 58-char address. Truncate `user.name`/`user.displayName` for
 * display only — this never reaches the server (it already has the username)
 * nor the in-app keystore mechanism, so the credential binding is unaffected.
 */
const truncateUserDisplayName = (options: unknown): unknown => {
    if (typeof options !== 'object' || options === null) return options
    const { user } = options as { user?: Record<string, unknown> }
    if (!user) return options
    const truncate = (value: unknown) =>
        typeof value === 'string' && isValidAlgorandAddress(value)
            ? truncateAlgorandAddress(value)
            : value
    return {
        ...options,
        user: {
            ...user,
            name: truncate(user.name),
            displayName: truncate(user.displayName),
        },
    }
}

/**
 * Creates the OS-native credential mechanism backed by react-native-passkey.
 *
 * This shim adapts the platform passkey APIs to the shape expected by the
 * Liquid Auth credentials polyfill (`navigator.credentials`). The OS performs
 * the assetlinks / associated-domains verification, so this mode is more
 * FIDO-compliant at the cost of UX.
 *
 * All react-native-passkey usage lives ONLY in this file; deleting OS mode is
 * a matter of removing this file, the matching branch in
 * `selectCredentialMechanism.ts`, and the react-native-passkey dep + stub.
 */
export const createOsPasskeyCredentialMechanism = (): CredentialMechanism => ({
    async get(options: unknown): Promise<unknown> {
        return Passkey.get(options as Parameters<typeof Passkey.get>[0])
    },
    async create(options: unknown): Promise<unknown> {
        return Passkey.create(
            truncateUserDisplayName(options) as Parameters<
                typeof Passkey.create
            >[0],
        )
    },
})
