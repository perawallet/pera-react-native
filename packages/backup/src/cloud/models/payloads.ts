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
import type { Nullable } from '@perawallet/wallet-core-shared'

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
    /** An account record's entry on a chain with no backup adapter of its
     *  own, derived from the record's backed-up HD seed. */
    hdChain: 'hdChain',
    /** An account record's entry for a key stored as a raw private key; the
     *  key rides as a `standaloneKey` secret. Also that secret's type. */
    standaloneKey: 'standaloneKey',
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

/** When and how the chain was enabled on the account; a record written before
 *  this was recorded has neither. Restore reads only whether the entry carries
 *  it, so an enabler a newer build adds still parses. */
const enabledAt = nonNegativeInt.optional().catch(undefined)
const enabledBy = z.string().min(1).optional().catch(undefined)

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
    enabledAt,
    enabledBy,
})
export const watchAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.watch),
    address,
    customName,
    updatedAt,
    enabledAt,
    enabledBy,
})
export const multisigAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.multisig),
    address,
    participantAddresses: z.array(z.string()),
    threshold: nonNegativeInt,
    version: nonNegativeInt,
    customName,
    updatedAt,
    enabledAt,
    enabledBy,
})
/** A chain account holding its own key; its recovery phrase is its `secrets/` item. */
export const chainKeyAddressPayloadSchema = z.object({
    type: chainBackupKindSchema,
    address,
    customName,
    updatedAt,
    enabledAt,
    enabledBy,
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
    enabledAt,
    enabledBy,
})

/** Never an item of its own: only an entry of an account record. */
export const hdChainAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.hdChain),
    address,
    seedFirstDerivedAddress: address,
    account: nonNegativeInt,
    keyIndex: nonNegativeInt,
    customName,
    updatedAt,
    enabledAt,
    enabledBy,
})
/** Never an item of its own: only an entry of an account record. */
export const standaloneKeyAddressPayloadSchema = z.object({
    type: z.literal(BackupAccountType.standaloneKey),
    address,
    customName,
    updatedAt,
    enabledAt,
    enabledBy,
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

export type HdChainAddressPayload = z.infer<typeof hdChainAddressPayloadSchema>
export type StandaloneKeyAddressPayload = z.infer<
    typeof standaloneKeyAddressPayloadSchema
>

/** One chain of one account, as the importer takes it: a legacy item, or one
 *  entry of an account record. */
export type AccountEntryPayload =
    | AddressBackupPayload
    | HdChainAddressPayload
    | StandaloneKeyAddressPayload

export const accountEntryPayloadSchema = z.union([
    addressBackupPayloadSchema,
    hdChainAddressPayloadSchema,
    standaloneKeyAddressPayloadSchema,
])

export type HdBackupPosition = {
    seedReference: string
    account: number
    keyIndex: number
}

/** Where an HD entry sits in its seed; null for every other kind. */
export const hdPositionOf = (
    payload: AccountEntryPayload,
): Nullable<HdBackupPosition> =>
    'seedFirstDerivedAddress' in payload &&
    payload.seedFirstDerivedAddress !== undefined &&
    'account' in payload &&
    'keyIndex' in payload
        ? {
              seedReference: payload.seedFirstDerivedAddress,
              account: payload.account,
              keyIndex: payload.keyIndex,
          }
        : null

/** The account an entry belongs to: an HD account spans one entry per chain at
 *  its seed position, any other account is its one address. */
export const accountIdentityOf = (payload: AccountEntryPayload): string => {
    const position = hdPositionOf(payload)
    return position === null
        ? payload.address
        : `${position.seedReference}/${position.account}/${position.keyIndex}`
}

export const isChainAddressPayload = (
    payload: AccountEntryPayload,
): payload is ChainAddressPayload => isChainBackupKind(payload.type)

export const isChainHdAddressPayload = (
    payload: AccountEntryPayload,
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

/** A raw private key. Carries its chain, since no other item says which
 *  chain's key it is. */
export const standaloneKeySecretsPayloadSchema = z.object({
    type: z.literal(BackupAccountType.standaloneKey),
    chain: z.string().min(1),
    address,
    /** Lowercase hex of the raw key; the chain decides the length. */
    privateKey: z.string().regex(/^(?:[0-9a-f]{2})+$/),
})

export const secretsBackupPayloadSchema = z.union([
    hdSeedSecretsPayloadSchema,
    standaloneKeySecretsPayloadSchema,
    chainMnemonicSecretsPayloadSchema,
])

export type HdSeedSecretsPayload = z.infer<typeof hdSeedSecretsPayloadSchema>
export type ChainMnemonicSecretsPayload = z.infer<
    typeof chainMnemonicSecretsPayloadSchema
>
export type StandaloneKeySecretsPayload = z.infer<
    typeof standaloneKeySecretsPayloadSchema
>
export type SecretsBackupPayload =
    | HdSeedSecretsPayload
    | StandaloneKeySecretsPayload
    | ChainMnemonicSecretsPayload

export const isHdSeedSecretsPayload = (
    payload: SecretsBackupPayload,
): payload is HdSeedSecretsPayload => payload.type === BackupAccountType.hdSeed

/** The record shape this build reads and writes. A record of a higher version
 *  is never imported and never overwritten; a newer client owns it. */
export const ACCOUNT_RECORD_FORMAT_VERSION = 2

/** Loose, so what a newer client adds to an entry survives a read and is
 *  written back by `mergeAccountRecord`. `chain` and `type` are plain strings
 *  for the same reason; an entry this build can't read is kept, not imported. */
export const accountRecordChainSchema = z.looseObject({
    chain: z.string().min(1),
    type: z.string().min(1),
    address,
})
export type AccountRecordChain = z.infer<typeof accountRecordChainSchema>

/**
 * One account, every chain of it. Each entry is that chain's address item
 * without the name and timestamp, which the record holds once: a chain with a
 * backup adapter writes its own kind, any other chain a kind the format owns.
 * Entries are in chain-id order. Key material stays in `secrets/` items.
 */
export const accountRecordPayloadSchema = z.looseObject({
    formatVersion: nonNegativeInt,
    customName,
    updatedAt,
    chains: z.array(accountRecordChainSchema).min(1),
})
export type AccountRecordPayload = z.infer<typeof accountRecordPayloadSchema>

/** The shape clients before contact records wrote under `contacts/`, which
 *  this build only reads. `image` is a device-local `file://` URI and `nfd` is
 *  re-resolvable from the address, so neither is backed up. */
export const contactBackupPayloadSchema = z.object({
    address,
    name: z.string(),
    updatedAt,
})

export type ContactBackupPayload = z.infer<typeof contactBackupPayloadSchema>

/** The record shape this build reads and writes. A record of a higher version
 *  is never imported and never overwritten; a newer client owns it. */
export const CONTACT_RECORD_FORMAT_VERSION = 1

/** Loose, with `family` a plain string, so an entry for a family this build
 *  doesn't know is kept by `mergeContactRecord` rather than dropped. */
export const contactRecordAddressSchema = z.looseObject({
    family: z.string().min(1),
    address,
})
export type ContactRecordAddress = z.infer<typeof contactRecordAddressSchema>

/** One contact, every chain family's address, in `CHAIN_FAMILIES` order so two
 *  devices holding it write the same bytes. `id` is the contact's own, which
 *  the importer matches on: two records may share an address. `image` and
 *  `nfd` stay out for the reasons above. */
export const contactRecordPayloadSchema = z.looseObject({
    formatVersion: nonNegativeInt,
    id: z.string().min(1),
    name: z.string(),
    updatedAt,
    addresses: z.array(contactRecordAddressSchema).min(1),
    /** Families the contact's address was removed from, so a merge drops the
     *  backup's copy rather than keeping it. Never names a family in
     *  `addresses`; a build that predates it keeps it as an unknown field. */
    removed: z.array(z.string().min(1)).optional(),
})
export type ContactRecordPayload = z.infer<typeof contactRecordPayloadSchema>

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
    /** Named by address: account ids are device-local. */
    accountOrder: settingsField(
        z.object({
            mode: z.string().min(1),
            addresses: z.array(z.string().min(1)),
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
    'accountOrder',
]
