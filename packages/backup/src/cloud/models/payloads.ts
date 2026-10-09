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

/**
 * The item kinds the backup format itself defines. Every other `type` an
 * account or secrets item carries is a chain's own kind, which only that
 * chain's backup adapter decodes.
 */
export const BackupAccountType = {
    hdSeed: 'hdSeed',
    hardware: 'hardware',
    watch: 'watch',
    multisig: 'multisig',
} as const
export type BackupAccountType =
    (typeof BackupAccountType)[keyof typeof BackupAccountType]

const BACKUP_FORMAT_KINDS: ReadonlySet<string> = new Set(
    Object.values(BackupAccountType),
)

// Branded so that ruling out the chain kinds narrows a payload union to the
// format's own literal kinds; a bare `string` member would survive every
// `type === 'watch'` check.
export const chainBackupKindSchema = z
    .string()
    .min(1)
    .refine(type => !BACKUP_FORMAT_KINDS.has(type), {
        message: 'A chain backup kind cannot reuse a backup format kind',
    })
    .brand<'ChainBackupKind'>()
export type ChainBackupKind = z.infer<typeof chainBackupKindSchema>

/** Mints a chain's wire kind; throws for a name the backup format owns. */
export const chainBackupKind = (wire: string): ChainBackupKind =>
    chainBackupKindSchema.parse(wire)

export const isChainBackupKind = (type: string): type is ChainBackupKind =>
    type.length > 0 && !BACKUP_FORMAT_KINDS.has(type)

/** Any `type` an account or secrets item carries. */
export type BackupItemKind = BackupAccountType | ChainBackupKind

export const backupHardwareTransportTypeSchema = z.enum(['ble', 'usb'])
export type BackupHardwareTransportType = z.infer<
    typeof backupHardwareTransportTypeSchema
>

const nonNegativeInt = z.number().int().nonnegative()

const customName = z
    .unknown()
    .optional()
    .transform(value => (typeof value === 'string' ? value : null))

/** Epoch millis of the last local content change; drives last-write-wins. */
const updatedAt = nonNegativeInt.optional()

/** Non-empty: every collector keys its join map on this, so an empty one would
 *  collide all such items onto a single entry. */
const address = z.string().min(1)

export const hdSeedAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.hdSeed),
    address,
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
/** A chain account holding its own key; its recovery phrase is its `secrets/` item. */
export const chainKeyAddressPayloadSchema = z.object({
    type: chainBackupKindSchema,
    address,
    customName,
    updatedAt,
    // An item naming a parent seed is an HD item; one missing the rest of the
    // HD fields must fail to parse rather than restore as a single key.
    seedFirstDerivedAddress: z.never().optional(),
})
/** A chain account derived from a backed-up HD seed, filed under the seed's first derived address. */
export const chainHdAddressPayloadSchema = z.object({
    type: chainBackupKindSchema,
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

export const addressBackupPayloadSchema = z.union([
    z.discriminatedUnion('type', [
        hdSeedAddressPayloadSchema,
        hardwareAddressPayloadSchema,
        watchAddressPayloadSchema,
        multisigAddressPayloadSchema,
    ]),
    chainHdAddressPayloadSchema,
    chainKeyAddressPayloadSchema,
])

export type HdSeedAddressPayload = z.infer<typeof hdSeedAddressPayloadSchema>
export type HardwareAddressPayload = z.infer<
    typeof hardwareAddressPayloadSchema
>
export type WatchAddressPayload = z.infer<typeof watchAddressPayloadSchema>
export type MultisigAddressPayload = z.infer<
    typeof multisigAddressPayloadSchema
>
export type ChainKeyAddressPayload = Omit<
    z.infer<typeof chainKeyAddressPayloadSchema>,
    'seedFirstDerivedAddress'
>
export type ChainHdAddressPayload = z.infer<typeof chainHdAddressPayloadSchema>
export type ChainAddressPayload = ChainKeyAddressPayload | ChainHdAddressPayload
export type AddressBackupPayload =
    | HdSeedAddressPayload
    | HardwareAddressPayload
    | WatchAddressPayload
    | MultisigAddressPayload
    | ChainAddressPayload

export const isChainAddressPayload = (
    payload: AddressBackupPayload,
): payload is ChainAddressPayload => isChainBackupKind(payload.type)

export const isChainHdAddressPayload = (
    payload: AddressBackupPayload,
): payload is ChainHdAddressPayload =>
    isChainAddressPayload(payload) && 'seedFirstDerivedAddress' in payload

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
/** A single-key chain account's recovery phrase. */
export const chainMnemonicSecretsPayloadSchema = z.object({
    type: chainBackupKindSchema,
    mnemonic: z.string(),
    address,
})

export const secretsBackupPayloadSchema = z.union([
    hdSeedSecretsPayloadSchema,
    chainMnemonicSecretsPayloadSchema,
])

export type HdSeedSecretsPayload = z.infer<typeof hdSeedSecretsPayloadSchema>
export type ChainMnemonicSecretsPayload = z.infer<
    typeof chainMnemonicSecretsPayloadSchema
>
export type SecretsBackupPayload =
    | HdSeedSecretsPayload
    | ChainMnemonicSecretsPayload

export const isHdSeedSecretsPayload = (
    payload: SecretsBackupPayload,
): payload is HdSeedSecretsPayload => payload.type === BackupAccountType.hdSeed

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
