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

// Anything that isn't a string — absent, null, a number — normalizes to null.
const customName = z
    .unknown()
    .optional()
    .transform(value => (typeof value === 'string' ? value : null))

export const algo25AddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.algo25),
    address: z.string(),
    customName,
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
})
export const hardwareAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.hardware),
    address: z.string(),
    // Device identifier for reconnection (e.g. BLE device id, USB descriptor id).
    deviceId: z.string(),
    // User-visible device name (e.g. "Ledger Nano X").
    deviceName: z.string(),
    // Sequential account index on the hardware wallet device (0, 1, 2...).
    accountIndex: nonNegativeInt,
    manufacturer: z.string(),
    transportType: backupHardwareTransportTypeSchema,
    customName,
})
export const watchAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.watch),
    address: z.string(),
    customName,
})
export const multisigAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.multisig),
    address: z.string(),
    participantAddresses: z.array(z.string()),
    threshold: nonNegativeInt,
    version: nonNegativeInt,
    customName,
})
/**
 * Post-quantum (Falcon) account. Flat and single-key — `QuantumAccount.keyPairId`
 * is a device-local keystore id that restore re-mints, so it is not backed up.
 */
export const quantumAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.quantum),
    address: z.string(),
    customName,
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
    // 25-word BIP39 mnemonic.
    mnemonic: z.string(),
})
export const hdSeedSecretsPayloadSchema = z.object({
    type: z.literal(BackupAccountType.hdSeed),
    // Hex-encoded XHD seed.
    seed: z.string(),
    // Hex-encoded BIP39 entropy.
    entropy: z.string(),
})
/**
 * A quantum recovery phrase is 25 words in the same wire format as algo25 and
 * is indistinguishable from one by content. The `type` discriminant is the only
 * signal routing restore to Falcon rather than Ed25519 derivation.
 */
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
