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

import type { Extension } from '@algorandfoundation/wallet-provider'
import type { KeyStoreExtension } from '@algorandfoundation/keystore'
import { LiquidAuthServiceImpl } from './service'
import { readLiquidAuthSessionCookie } from './sessionCookie'
import type { LiquidAuthExtension } from './types'

type WebAuthnCredential = {
    id: string
    response: unknown
    clientExtensionResults: Record<string, unknown>
}

/**
 * Reads the navigator.credentials polyfill installed by bootstrapLiquidAuth().
 * Throws a clear error if the bootstrap was not called so a misconfigured build
 * fails loudly rather than silently.
 */
const getCredentials = () => {
    const credentials = (
        globalThis as {
            navigator?: {
                credentials?: {
                    get: (o: unknown) => Promise<unknown>
                    create: (o: unknown) => Promise<unknown>
                }
            }
        }
    ).navigator?.credentials
    if (!credentials) {
        throw new Error(
            'navigator.credentials unavailable — call bootstrapLiquidAuth() at app startup',
        )
    }
    return credentials
}

/**
 * wallet-provider Extension that registers the Liquid Auth service. Must be
 * composed AFTER `WithKeyStore` — it uses `provider.key.store.sign` to produce
 * the Ed25519 binding signature. The WebAuthn get/create collaborators delegate
 * to the navigator.credentials polyfill installed by bootstrapLiquidAuth().
 */
export const WithLiquidAuth: Extension<LiquidAuthExtension> = (
    provider: KeyStoreExtension & Record<string, unknown>,
) => {
    const keyStore = provider.key.store as unknown as {
        sign(keyId: string, data: Uint8Array): Promise<Uint8Array>
    }

    const service = new LiquidAuthServiceImpl({
        signChallenge: (keyId, challenge) => keyStore.sign(keyId, challenge),
        getCredential: async options =>
            (await getCredentials().get(options)) as WebAuthnCredential,
        createCredential: async options =>
            (await getCredentials().create(options)) as WebAuthnCredential,
        // v1: always runs the attestation path — no local passkey-existence
        // check yet. Assertion reuse (returning an existing credentialId) is a
        // follow-up once the credential store is in place.
        hasCredentialForHost: async () => null,
        getSessionCookie: readLiquidAuthSessionCookie,
    })

    provider.liquidAuth = service
    return { liquidAuth: service }
}
