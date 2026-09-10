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
    commitSecret,
    removeSecret,
    withSecret,
} from '@perawallet/wallet-core-kms'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import {
    LOGIN_KIND,
    LOGIN_PAYLOAD_VERSION,
    decodeLoginPayload,
    encodeLoginPayload,
    isLoginKey,
    newLoginId,
    type Login,
    type LoginSecret,
} from '../models/login'

export type SaveLoginInput = {
    /** Omit to create; supply to update in place. */
    id?: string
    domain: string
    username: string
    password: string
    note: string | null
}

const withoutPassword = (secret: LoginSecret): Login => {
    const { password: _sealed, ...rest } = secret
    return rest
}

const loginIds = (): string[] =>
    getKeystoreStore()
        .state.keys.filter(isLoginKey)
        .map(key => key.id)

export const readLogin = async (id: string): Promise<LoginSecret | null> =>
    (await withSecret(id, bytes => decodeLoginPayload(id, bytes))) ?? null

/**
 * Every field but the plaintext discriminator is sealed, so listing means
 * unsealing each record. Cheap at the record counts this feature produces, and
 * it is what keeps the set of services a person has accounts with off disk in
 * the clear.
 */
export const listLogins = async (): Promise<Login[]> => {
    const secrets = await Promise.all(loginIds().map(readLogin))
    return secrets
        .filter((secret): secret is LoginSecret => secret !== null)
        .map(withoutPassword)
        .sort((a, b) => a.domain.localeCompare(b.domain))
}

export const saveLogin = async (
    input: SaveLoginInput,
    now: number = Date.now(),
): Promise<Login> => {
    const id = input.id ?? newLoginId()
    const existing = input.id ? await readLogin(input.id) : null

    const secret: LoginSecret = {
        id,
        domain: input.domain,
        username: input.username,
        password: input.password,
        note: input.note,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    }

    const bytes = encodeLoginPayload(secret)
    await commitSecret({
        id,
        bytes,
        metadata: { kind: LOGIN_KIND, v: LOGIN_PAYLOAD_VERSION },
    })

    return withoutPassword(secret)
}

export const deleteLogin = async (id: string): Promise<void> => {
    await removeSecret(id)
}
