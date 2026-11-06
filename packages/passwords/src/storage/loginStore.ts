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
    LOGIN_PASSWORD_KIND,
    LOGIN_PAYLOAD_VERSION,
    decodeLoginPayload,
    decodePasswordPayload,
    encodeLoginPayload,
    encodePasswordPayload,
    isLoginKey,
    loginPasswordId,
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

const loginIds = (): string[] =>
    getKeystoreStore()
        .state.keys.filter(isLoginKey)
        .map(key => key.id)

const readSummary = async (id: string): Promise<Login | null> =>
    (await withSecret(id, bytes => decodeLoginPayload(id, bytes))) ?? null

/** The only reader of a password record; listing must never call it. */
export const readLogin = async (id: string): Promise<LoginSecret | null> => {
    const summary = await readSummary(id)
    if (summary === null) return null
    const password = await withSecret(loginPasswordId(id), decodePasswordPayload)
    return password === null || password === undefined
        ? null
        : { ...summary, password }
}

/**
 * Every field but the plaintext discriminator is sealed, so listing means
 * unsealing each summary record. It never touches the password records, so no
 * plaintext password is materialised by a list render or an identity publish.
 */
export const listLogins = async (): Promise<Login[]> => {
    const summaries = await Promise.all(loginIds().map(readSummary))
    return summaries
        .filter((summary): summary is Login => summary !== null)
        .sort((a, b) => a.domain.localeCompare(b.domain))
}

export const saveLogin = async (
    input: SaveLoginInput,
    now: number = Date.now(),
): Promise<Login> => {
    const id = input.id ?? newLoginId()
    const existing = input.id ? await readSummary(input.id) : null

    const summary: Login = {
        id,
        domain: input.domain,
        username: input.username,
        note: input.note,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    }

    // Password first: a summary is what makes a login visible, so a failure
    // between the two writes leaves an unlisted orphan rather than a login
    // that lists but cannot be revealed.
    await commitSecret({
        id: loginPasswordId(id),
        bytes: encodePasswordPayload(input.password),
        metadata: { kind: LOGIN_PASSWORD_KIND, v: LOGIN_PAYLOAD_VERSION },
    })
    await commitSecret({
        id,
        bytes: encodeLoginPayload(summary),
        metadata: { kind: LOGIN_KIND, v: LOGIN_PAYLOAD_VERSION },
    })

    return summary
}

export const deleteLogin = async (id: string): Promise<void> => {
    await removeSecret(id)
    await removeSecret(loginPasswordId(id))
}
