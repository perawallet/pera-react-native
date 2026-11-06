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

import { v4 as uuidv4 } from 'uuid'
import type { Key } from '@algorandfoundation/keystore-core'

/** Plaintext discriminator written to the keystore's unsealed `k/<id>` record. */
export const LOGIN_KIND = 'login'

/** Plaintext discriminator of the record holding only a login's password. */
export const LOGIN_PASSWORD_KIND = 'login-password'

export const LOGIN_PAYLOAD_VERSION = 1

const ID_PREFIX = 'pera.login.'

export type Login = {
    id: string
    domain: string
    username: string
    note: string | null
    /** Epoch millis. */
    createdAt: number
    /** Epoch millis. */
    updatedAt: number
}

export type LoginSecret = Login & { password: string }

// A `/` would collide with the keystore driver's own `k/` and `m/` storage
// prefixes, so the id namespace uses dots like every other Pera secret id.
export const newLoginId = (): string => `${ID_PREFIX}${uuidv4()}`

/**
 * A login is two sealed records: the summary under `id` and the password under
 * this id, so listing never unseals a password. The Android and iOS providers
 * derive the same id (`PasswordCredentialStore`); change both together.
 */
export const loginPasswordId = (id: string): string => `${id}.password`

/**
 * Logins share the canonical `secret-key` type with the hashed PIN record, the
 * mirrored biometric blob and the Pera Card session tokens, so the record type
 * cannot tell them apart. The discriminator lives in plaintext metadata
 * instead — it is the only login field that is not sealed.
 */
export const isLoginKey = (key: Key): boolean =>
    (key.metadata as Record<string, unknown> | undefined)?.kind === LOGIN_KIND

export const encodeLoginPayload = (summary: Omit<Login, 'id'>): Uint8Array =>
    new TextEncoder().encode(
        JSON.stringify({
            v: LOGIN_PAYLOAD_VERSION,
            domain: summary.domain,
            username: summary.username,
            note: summary.note,
            createdAt: summary.createdAt,
            updatedAt: summary.updatedAt,
        }),
    )

export const encodePasswordPayload = (password: string): Uint8Array =>
    new TextEncoder().encode(
        JSON.stringify({ v: LOGIN_PAYLOAD_VERSION, password }),
    )

const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number'

const parseVersioned = (bytes: Uint8Array): Record<string, unknown> | null => {
    let parsed: unknown
    try {
        parsed = JSON.parse(new TextDecoder().decode(bytes))
    } catch {
        return null
    }
    if (typeof parsed !== 'object' || parsed === null) return null

    const record = parsed as Record<string, unknown>
    return record.v === LOGIN_PAYLOAD_VERSION ? record : null
}

export const decodeLoginPayload = (
    id: string,
    bytes: Uint8Array,
): Login | null => {
    const record = parseVersioned(bytes)
    if (
        record === null ||
        !isString(record.domain) ||
        !isString(record.username) ||
        !isNumber(record.createdAt) ||
        !isNumber(record.updatedAt)
    ) {
        return null
    }

    return {
        id,
        domain: record.domain,
        username: record.username,
        note: isString(record.note) ? record.note : null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    }
}

export const decodePasswordPayload = (bytes: Uint8Array): string | null => {
    const record = parseVersioned(bytes)
    return record !== null && isString(record.password) ? record.password : null
}
