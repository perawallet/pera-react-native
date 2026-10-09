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
import { CHAIN_IDS, type ChainId } from '@perawallet/wallet-core-chain-contract'

export const BackupAccountType = {
    algo25: 'algo25',
    hdSeed: 'hdSeed',
    hdWallet: 'hdWallet',
    hardware: 'hardware',
    watch: 'watch',
    multisig: 'multisig',
    quantum: 'quantum',
    /** An HD-derived account on a non-legacy chain; carries `chain`. */
    hdChain: 'hdChain',
    /** A private-key account on a non-legacy chain; its key rides as a secret. */
    standaloneKey: 'standaloneKey',
    /** Distinct from `watch` so a client that predates chains rejects it at
     *  parse instead of importing it as an Algorand watch account. */
    watchChain: 'watchChain',
} as const
export type BackupAccountType =
    (typeof BackupAccountType)[keyof typeof BackupAccountType]

export const backupHardwareTransportTypeSchema = z.enum(['ble', 'usb'])
export type BackupHardwareTransportType = z.infer<
    typeof backupHardwareTransportTypeSchema
>

const nonNegativeInt = z.number().int().nonnegative()

// An id this build doesn't know fails the parse, which skips the item.
const chainIdSchema = z.enum(CHAIN_IDS)

const customName = z
    .unknown()
    .optional()
    .transform(value => (typeof value === 'string' ? value : null))

/** Epoch millis of the last local content change; drives last-write-wins. */
const updatedAt = nonNegativeInt.optional()

/** Non-empty: every collector keys its join map on this, so an empty one would
 *  collide all such items onto a single entry. */
const address = z.string().min(1)

export const algo25AddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.algo25),
    address,
    customName,
    updatedAt,
})
export const hdSeedAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.hdSeed),
    address,
})
export const hdWalletAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.hdWallet),
    address,
    seedFirstDerivedAddress: address,
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
    address,
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
    address,
    customName,
    updatedAt,
})
export const multisigAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.multisig),
    address,
    participantAddresses: z.array(z.string()),
    threshold: nonNegativeInt,
    version: nonNegativeInt,
    customName,
    updatedAt,
})
export const quantumAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.quantum),
    address,
    customName,
    updatedAt,
})
export const hdChainAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.hdChain),
    chain: chainIdSchema,
    address,
    seedFirstDerivedAddress: address,
    account: nonNegativeInt,
    keyIndex: nonNegativeInt,
    customName,
    updatedAt,
})
export const standaloneKeyAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.standaloneKey),
    chain: chainIdSchema,
    address,
    customName,
    updatedAt,
})
export const watchChainAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.watchChain),
    chain: chainIdSchema,
    address,
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
    hdChainAddressPayloadSchema,
    standaloneKeyAddressPayloadSchema,
    watchChainAddressPayloadSchema,
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
export type HdChainAddressPayload = z.infer<typeof hdChainAddressPayloadSchema>
export type StandaloneKeyAddressPayload = z.infer<
    typeof standaloneKeyAddressPayloadSchema
>
export type WatchChainAddressPayload = z.infer<
    typeof watchChainAddressPayloadSchema
>
export type AddressBackupPayload = z.infer<typeof addressBackupPayloadSchema>

export const algo25SecretsPayloadSchema = z.object({
    type: z.literal(BackupAccountType.algo25),
    mnemonic: z.string(),
    address,
})
export const hdSeedSecretsPayloadSchema = z.object({
    type: z.literal(BackupAccountType.hdSeed),
    // Hex-encoded XHD seed.
    seed: z.string(),
    // Hex-encoded BIP39 entropy.
    entropy: z.string(),
    /** The seed's first derived address, which is what this item is filed
     *  under and a restoring device's only way to place it. */
    address,
})
export const quantumSecretsPayloadSchema = z.object({
    type: z.literal(BackupAccountType.quantum),
    mnemonic: z.string(),
    address,
})
export const standaloneKeySecretsPayloadSchema = z.object({
    type: z.literal(BackupAccountType.standaloneKey),
    chain: chainIdSchema,
    address,
    /** Lowercase hex of the raw key; the chain decides the length. */
    privateKey: z.string().regex(/^(?:[0-9a-f]{2})+$/),
})

export const secretsBackupPayloadSchema = z.discriminatedUnion('type', [
    algo25SecretsPayloadSchema,
    hdSeedSecretsPayloadSchema,
    quantumSecretsPayloadSchema,
    standaloneKeySecretsPayloadSchema,
])

export type Algo25SecretsPayload = z.infer<typeof algo25SecretsPayloadSchema>
export type HdSeedSecretsPayload = z.infer<typeof hdSeedSecretsPayloadSchema>
export type QuantumSecretsPayload = z.infer<typeof quantumSecretsPayloadSchema>
export type StandaloneKeySecretsPayload = z.infer<
    typeof standaloneKeySecretsPayloadSchema
>
export type SecretsBackupPayload = z.infer<typeof secretsBackupPayloadSchema>

/** Null for a legacy kind, whose chain is implicit. */
export const payloadChain = (
    payload: AddressBackupPayload | SecretsBackupPayload,
): ChainId | null => ('chain' in payload ? payload.chain : null)

export type HdBackupPosition = {
    seedReference: string
    account: number
    keyIndex: number
}

/** Where an HD item sits in its seed; null for every other kind. */
export const hdPositionOf = (
    payload: AddressBackupPayload,
): HdBackupPosition | null =>
    payload.type === BackupAccountType.hdWallet ||
    payload.type === BackupAccountType.hdChain
        ? {
              seedReference: payload.seedFirstDerivedAddress,
              account: payload.account,
              keyIndex: payload.keyIndex,
          }
        : null

/** No discriminant: the `contacts/` prefix and the CONTACT item type already
 *  identify the shape. `image` is a device-local `file://` URI and `nfd` is
 *  re-resolvable from the address, so neither is backed up. */
export const contactBackupPayloadSchema = z.object({
    address,
    name: z.string(),
    updatedAt,
})

export type ContactBackupPayload = z.infer<typeof contactBackupPayloadSchema>

/** No discriminant: the `passkeys/` prefix and the PASSKEY item type already
 *  identify the shape. Holds no key material; that is `passkey-secrets/`.
 *  `identity`, `counter` and `seedAddress` are the derivation inputs, present
 *  when this credential was proven against its seed; a restore only falls back
 *  to them for a credential whose `passkey-secrets/` item is missing.
 *  `userId`/`userName`/`displayName` only build the native record and label the
 *  UI, and must never reach derivation — they are not consistently encoded
 *  across the platforms that wrote them. */
export const passkeyBackupPayloadSchema = z.object({
    credentialId: z.string(),
    origin: z.string(),
    identity: z.string().optional(),
    counter: nonNegativeInt.optional(),
    /** Base64 of the 91-byte X.509 SPKI DER; the restore-time match target. */
    publicKeySpkiDer: z.string(),
    /** First-derived address of the owning seed, joining to its `secrets/` item. */
    seedAddress: z.string().optional(),
    userId: z.string().optional(),
    userName: z.string().optional(),
    displayName: z.string().optional(),
    createdAt: nonNegativeInt,
    updatedAt,
})

export type PasskeyBackupPayload = z.infer<typeof passkeyBackupPayloadSchema>

/** No `updatedAt`: like an account secret, a credential's key never changes. */
export const passkeySecretsBackupPayloadSchema = z.object({
    credentialId: z.string(),
    /** Base64 of the raw 32-byte P-256 private scalar. */
    privateKey: z.string(),
})

export type PasskeySecretsBackupPayload = z.infer<
    typeof passkeySecretsBackupPayloadSchema
>

/** `updatedAt` is per field (epoch millis; 0 = never edited) so edits to
 *  different settings on two devices both survive. A field that fails to parse
 *  is dropped, not the item: a newer client may write values this one lacks. */
const settingsField = <T extends z.ZodType>(value: T) =>
    z.object({ value, updatedAt: nonNegativeInt }).optional().catch(undefined)

export const settingsBackupPayloadSchema = z.object({
    currency: settingsField(
        z.object({
            preferred: z.string().min(1),
            fallback: z.string().min(1),
        }),
    ),
    language: settingsField(z.string().min(1)),
    confirmationMode: settingsField(z.string().min(1)),
    launchAccount: settingsField(
        z.object({
            mode: z.string().min(1),
            address: z.string().nullable(),
        }),
    ),
})

export type SettingsBackupPayload = z.infer<typeof settingsBackupPayloadSchema>

export type BackupSettings = {
    [K in keyof SettingsBackupPayload]-?: NonNullable<
        SettingsBackupPayload[K]
    >['value']
}

export type BackupSettingsField = keyof BackupSettings

export const BACKUP_SETTINGS_FIELDS: readonly BackupSettingsField[] = [
    'currency',
    'language',
    'confirmationMode',
    'launchAccount',
]
