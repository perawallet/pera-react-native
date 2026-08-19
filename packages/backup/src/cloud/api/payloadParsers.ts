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

import type { z } from 'zod'
import {
    addressBackupPayloadSchema,
    secretsBackupPayloadSchema,
    type AddressBackupPayload,
    type SecretsBackupPayload,
} from '../models'

export class BackupPayloadParseError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'BackupPayloadParseError'
    }
}

const parsePayload = <T>(
    schema: z.ZodType<T, unknown>,
    raw: string,
    kind: string,
): T => {
    let json: unknown
    try {
        json = JSON.parse(raw)
    } catch (error) {
        const detail = error instanceof Error ? `: ${error.message}` : ''
        throw new BackupPayloadParseError(`Payload is not valid JSON${detail}`)
    }

    const result = schema.safeParse(json)
    if (!result.success) {
        const [issue] = result.error.issues
        const path = issue?.path.join('.')
        throw new BackupPayloadParseError(
            `Invalid ${kind} payload${path ? ` at ${path}` : ''}: ${issue?.message ?? 'unknown error'}`,
        )
    }
    return result.data
}

export const parseAddressPayload = (raw: string): AddressBackupPayload =>
    parsePayload(addressBackupPayloadSchema, raw, 'account')

export const parseSecretsPayload = (raw: string): SecretsBackupPayload =>
    parsePayload(secretsBackupPayloadSchema, raw, 'secrets')
