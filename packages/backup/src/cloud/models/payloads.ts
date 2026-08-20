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

export const BackupAccountType = {
    algo25: 'algo25',
    hdSeed: 'hdSeed',
    hdWallet: 'hdWallet',
    hardware: 'hardware',
    watch: 'watch',
    multisig: 'multisig',
    quantum: 'quantum',
} as const
export type BackupAccountType =
    (typeof BackupAccountType)[keyof typeof BackupAccountType]

export const backupHardwareTransportTypeSchema = z.enum(['ble', 'usb'])
export type BackupHardwareTransportType = z.infer<
    typeof backupHardwareTransportTypeSchema
>

const nonNegativeInt = z.number().int().nonnegative()

const customName = z
    .unknown()
    .optional()
    .transform(value => (typeof value === 'string' ? value : null))

/**
 * Epoch millis of the last local content change. Drives last-write-wins when
 * two devices edit the same account, so it rides in every mutable payload.
 */
const updatedAt = nonNegativeInt.optional()

export const algo25AddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.algo25),
    address: z.string(),
    customName,
    updatedAt,
})
export const hdSeedAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.hdSeed),
    address: z.string(),
})
export const hdWalletAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.hdWallet),
    address: z.string(),
    seedFirstDerivedAddress: z.string(),
    publicKey: z.string(),
    account: nonNegativeInt,
    change: nonNegativeInt,
    keyIndex: nonNegativeInt,
    derivationType: nonNegativeInt,
    customName,
    updatedAt,
})
export const hardwareAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.hardware),
    address: z.string(),
    deviceId: z.string(),
    deviceName: z.string(),
    accountIndex: nonNegativeInt,
    manufacturer: z.string(),
    transportType: backupHardwareTransportTypeSchema,
    customName,
    updatedAt,
})
export const watchAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.watch),
    address: z.string(),
    customName,
    updatedAt,
})
export const multisigAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.multisig),
    address: z.string(),
    participantAddresses: z.array(z.string()),
    threshold: nonNegativeInt,
    version: nonNegativeInt,
    customName,
    updatedAt,
})
export const quantumAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.quantum),
    address: z.string(),
    customName,
    updatedAt,
})

export const addressBackupPayloadSchema = z.discriminatedUnion('type', [
    algo25AddressPayloadSchema,
    hdSeedAddressPayloadSchema,
    hdWalletAddressPayloadSchema,
    hardwareAddressPayloadSchema,
    watchAddressPayloadSchema,
    multisigAddressPayloadSchema,
    quantumAddressPayloadSchema,
])

export type Algo25AddressPayload = z.infer<typeof algo25AddressPayloadSchema>
export type HdSeedAddressPayload = z.infer<typeof hdSeedAddressPayloadSchema>
export type HdWalletAddressPayload = z.infer<
    typeof hdWalletAddressPayloadSchema
>
export type HardwareAddressPayload = z.infer<
    typeof hardwareAddressPayloadSchema
>
export type WatchAddressPayload = z.infer<typeof watchAddressPayloadSchema>
export type MultisigAddressPayload = z.infer<
    typeof multisigAddressPayloadSchema
>
export type QuantumAddressPayload = z.infer<typeof quantumAddressPayloadSchema>
export type AddressBackupPayload = z.infer<typeof addressBackupPayloadSchema>

export const algo25SecretsPayloadSchema = z.object({
    type: z.literal(BackupAccountType.algo25),
    mnemonic: z.string(),
})
export const hdSeedSecretsPayloadSchema = z.object({
    type: z.literal(BackupAccountType.hdSeed),
    // Hex-encoded XHD seed.
    seed: z.string(),
    // Hex-encoded BIP39 entropy.
    entropy: z.string(),
})
export const quantumSecretsPayloadSchema = z.object({
    type: z.literal(BackupAccountType.quantum),
    mnemonic: z.string(),
})

export const secretsBackupPayloadSchema = z.discriminatedUnion('type', [
    algo25SecretsPayloadSchema,
    hdSeedSecretsPayloadSchema,
    quantumSecretsPayloadSchema,
])

export type Algo25SecretsPayload = z.infer<typeof algo25SecretsPayloadSchema>
export type HdSeedSecretsPayload = z.infer<typeof hdSeedSecretsPayloadSchema>
export type QuantumSecretsPayload = z.infer<typeof quantumSecretsPayloadSchema>
export type SecretsBackupPayload = z.infer<typeof secretsBackupPayloadSchema>
