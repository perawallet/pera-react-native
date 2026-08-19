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

import { z } from 'zod'
import {
    BackupAccountType,
    type AddressBackupPayload,
    type SecretsBackupPayload,
} from '../models'

export class BackupPayloadParseError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'BackupPayloadParseError'
    }
}

const nonNegativeInt = z.number().int().nonnegative()

const customName = z
    .unknown()
    .optional()
    .transform(value => (typeof value === 'string' ? value : null))

const addressPayloadSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal(BackupAccountType.algo25),
        address: z.string(),
        customName,
    }),
    z.object({
        type: z.literal(BackupAccountType.hdSeed),
        address: z.string(),
    }),
    z.object({
        type: z.literal(BackupAccountType.hdWallet),
        address: z.string(),
        seedFirstDerivedAddress: z.string(),
        publicKey: z.string(),
        account: nonNegativeInt,
        change: nonNegativeInt,
        keyIndex: nonNegativeInt,
        derivationType: nonNegativeInt,
        customName,
    }),
    z.object({
        type: z.literal(BackupAccountType.hardware),
        address: z.string(),
        deviceId: z.string(),
        deviceName: z.string(),
        accountIndex: nonNegativeInt,
        manufacturer: z.string(),
        transportType: z.enum(['ble', 'usb']),
        customName,
    }),
    z.object({
        type: z.literal(BackupAccountType.watch),
        address: z.string(),
        customName,
    }),
    z.object({
        type: z.literal(BackupAccountType.multisig),
        address: z.string(),
        participantAddresses: z.array(z.string()),
        threshold: nonNegativeInt,
        version: nonNegativeInt,
        customName,
    }),
    z.object({
        type: z.literal(BackupAccountType.quantum),
        address: z.string(),
        customName,
    }),
]) satisfies z.ZodType<AddressBackupPayload, unknown>

const secretsPayloadSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal(BackupAccountType.algo25),
        mnemonic: z.string(),
    }),
    z.object({
        type: z.literal(BackupAccountType.hdSeed),
        seed: z.string(),
        entropy: z.string(),
    }),
    z.object({
        type: z.literal(BackupAccountType.quantum),
        mnemonic: z.string(),
    }),
]) satisfies z.ZodType<SecretsBackupPayload, unknown>

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
    parsePayload(addressPayloadSchema, raw, 'account')

export const parseSecretsPayload = (raw: string): SecretsBackupPayload =>
    parsePayload(secretsPayloadSchema, raw, 'secrets')
