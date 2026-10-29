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
import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'
import {
    accountRecordPayloadSchema,
    addressBackupPayloadSchema,
    contactBackupPayloadSchema,
    contactRecordPayloadSchema,
    passkeyBackupPayloadSchema,
    passkeySecretsBackupPayloadSchema,
    secretsBackupPayloadSchema,
    settingsBackupPayloadSchema,
    type AccountRecordPayload,
    type AddressBackupPayload,
    type ContactBackupPayload,
    type ContactRecordPayload,
    type PasskeyBackupPayload,
    type PasskeySecretsBackupPayload,
    type SecretsBackupPayload,
    type SettingsBackupPayload,
} from '../models'

export class BackupPayloadParseError extends AppError {
    constructor(message: string) {
        super(message, { category: ErrorCategory.STORAGE })
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

export const parseAccountRecordPayload = (raw: string): AccountRecordPayload =>
    parsePayload(accountRecordPayloadSchema, raw, 'account record')

export const parseSecretsPayload = (raw: string): SecretsBackupPayload =>
    parsePayload(secretsBackupPayloadSchema, raw, 'secrets')

export const parseContactPayload = (raw: string): ContactBackupPayload =>
    parsePayload(contactBackupPayloadSchema, raw, 'contact')

export const parseContactRecordPayload = (raw: string): ContactRecordPayload =>
    parsePayload(contactRecordPayloadSchema, raw, 'contact record')

export const parsePasskeyPayload = (raw: string): PasskeyBackupPayload =>
    parsePayload(passkeyBackupPayloadSchema, raw, 'passkey')

export const parsePasskeySecretsPayload = (
    raw: string,
): PasskeySecretsBackupPayload =>
    parsePayload(passkeySecretsBackupPayloadSchema, raw, 'passkey secrets')

export const parseSettingsPayload = (raw: string): SettingsBackupPayload =>
    parsePayload(settingsBackupPayloadSchema, raw, 'settings')
