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
    LEGACY_CHAIN_FAMILY,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    derivedContactId,
    type ContactAddresses,
} from '@perawallet/wallet-core-contacts'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { fetchManifest, readItems } from '../api'
import {
    parseAccountRecordPayload,
    parseAddressPayload,
    parseContactPayload,
    parseContactRecordPayload,
    parsePasskeyPayload,
    parsePasskeySecretsPayload,
    parseSecretsPayload,
    parseSettingsPayload,
} from '../api/payloadParsers'
import { decryptItemPayload } from '../crypto/itemPayload'
import {
    accountIdentityOf,
    accountRecordAddresses,
    accountRecordEntries,
    accountRecordIdentity,
    accountRecordType,
    contactRecordAddresses,
    contactRecordEntries,
    contactRecordRemovedFamilies,
    isAccountRecordKey,
    isAccountRecordReadable,
    isContactRecordKey,
    isContactRecordReadable,
    BACKUP_ACCOUNT_RECORDS_KEY_PREFIX,
    BACKUP_ACCOUNTS_KEY_PREFIX,
    BACKUP_CONTACT_RECORDS_KEY_PREFIX,
    BACKUP_CONTACTS_KEY_PREFIX,
    BACKUP_PASSKEYS_KEY_PREFIX,
    BACKUP_PASSKEY_SECRETS_KEY_PREFIX,
    BACKUP_SECRETS_KEY_PREFIX,
    BACKUP_SETTINGS_KEY_PREFIX,
    BackupAccountType,
    BackupItemStatus,
    isContactItemKey,
    isPasskeyItemKey,
    isPasskeySecretsItemKey,
    isSettingsItemKey,
    type AccountEntryPayload,
    type AccountRecordPayload,
    type AddressBackupPayload,
    type BackupId,
    type BackupItemKey,
    type ContactBackupPayload,
    type ContactRecordPayload,
    type DeviceId,
    type FetchedItem,
    type ManifestItem,
    type PasskeyBackupPayload,
    type PasskeySecretsBackupPayload,
    type SecretsBackupPayload,
    type SettingsBackupPayload,
    type SyncItemState,
} from '../models'
import { canRestoreRecordEntry } from '../sync/backupChains'
import type { PulledContact, PulledPasskey } from '../sync/types'

const READ_BATCH_SIZE = 50

/** One chain of one account. `group` is the account's identity, shared by
 *  every chain of it, so the import can treat them as one account. */
export type PulledAccount = {
    address: string
    group: string
    /** A record entry's chain; absent for a legacy item, which is on the
     *  backup's scope chain. */
    chain?: ChainId
    addressPayload: AccountEntryPayload
    secretsPayload: Nullable<SecretsBackupPayload>
}

/** What a tracked item caches about its payload; the key is a hash. */
export type TrackedIdentifiers = Pick<
    SyncItemState,
    'address' | 'addresses' | 'accountType' | 'record' | 'label'
>

export type PulledSettings = {
    key: BackupItemKey
    payload: SettingsBackupPayload
}

export type SkippedItem = {
    key: BackupItemKey
    /** `newer`: a record only a newer client can restore. */
    reason: 'decrypt' | 'parse' | 'newer'
}

export type PullBackupItemsResult = {
    backupGlobalHash: string
    lastSeq: number
    /** Every key the backup holds and the version it holds it at — including
     *  tombstones and items the restore could not read, which the caller still
     *  has to track or it will offer them to the server as new. */
    manifestItems: Record<BackupItemKey, ManifestItem>
    /** What each read item was filed under. This pull is the only place a
     *  restore can learn it: the key is an HMAC. */
    trackedByKey: Record<BackupItemKey, TrackedIdentifiers>
    accounts: PulledAccount[]
    contacts: PulledContact[]
    passkeys: PulledPasskey[]
    settings: Nullable<PulledSettings>
    skipped: SkippedItem[]
}

type PullBackupItemsParams = {
    backupId: BackupId
    deviceId: DeviceId
    encryptionKey: Uint8Array
}

const chunk = <T>(items: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size))
    }
    return out
}

/** Keys of the active items that should be read and restored. Read from the
 *  manifest and never from a `from_seq=0` delta: once changelog retention has
 *  pruned anything, seq 0 is itself out of the window and the delta call fails
 *  permanently — which would make every restore of a busy backup fail with it.
 *
 *  Contacts are in here because the restore is their only way home: it seeds
 *  `lastSyncedSeq` from the manifest, so no later delta ever mentions an item
 *  that was already in the backup when the device joined. */
const selectWantedKeys = (
    manifestItems: Record<BackupItemKey, ManifestItem>,
): BackupItemKey[] =>
    Object.entries(manifestItems)
        .filter(
            ([key, item]) =>
                item.status === BackupItemStatus.ACTIVE &&
                (key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX) ||
                    key.startsWith(BACKUP_ACCOUNT_RECORDS_KEY_PREFIX) ||
                    key.startsWith(BACKUP_SECRETS_KEY_PREFIX) ||
                    key.startsWith(BACKUP_CONTACTS_KEY_PREFIX) ||
                    key.startsWith(BACKUP_CONTACT_RECORDS_KEY_PREFIX) ||
                    key.startsWith(BACKUP_PASSKEYS_KEY_PREFIX) ||
                    key.startsWith(BACKUP_PASSKEY_SECRETS_KEY_PREFIX) ||
                    key.startsWith(BACKUP_SETTINGS_KEY_PREFIX)),
        )
        .map(([key]) => key)

const readItemsInBatches = async (
    backupId: BackupId,
    deviceId: DeviceId,
    keys: BackupItemKey[],
): Promise<FetchedItem[]> => {
    const items: FetchedItem[] = []
    for (const batch of chunk(keys, READ_BATCH_SIZE)) {
        items.push(...(await readItems(backupId, deviceId, batch)))
    }
    return items
}

const decryptItem = (
    item: FetchedItem,
    encryptionKey: Uint8Array,
    backupId: BackupId,
): Nullable<string> => {
    try {
        return decryptItemPayload(item.payload, {
            encryptionKey,
            backupId,
            key: item.key,
        })
    } catch {
        logger.warn('pullBackupItems: failed to decrypt item', {
            key: item.key,
        })
        return null
    }
}

type CollectedPayloads = {
    records: AccountRecordPayload[]
    addressPayloads: Map<string, AddressBackupPayload>
    secretsPayloads: Map<string, SecretsBackupPayload>
    contactRecords: ContactRecordPayload[]
    contacts: ContactBackupPayload[]
    passkeys: PulledPasskey[]
    settings: Nullable<PulledSettings>
    trackedByKey: Record<BackupItemKey, TrackedIdentifiers>
    skipped: SkippedItem[]
}

type ParsedItemPayload =
    | { kind: 'record'; payload: AccountRecordPayload }
    | { kind: 'address'; payload: AddressBackupPayload }
    | { kind: 'secrets'; payload: SecretsBackupPayload }
    | { kind: 'contact'; payload: ContactBackupPayload }
    | { kind: 'contactRecord'; payload: ContactRecordPayload }
    | { kind: 'passkey'; payload: PasskeyBackupPayload }
    | { kind: 'passkeySecrets'; payload: PasskeySecretsBackupPayload }
    | { kind: 'settings'; payload: SettingsBackupPayload }

/** The prefixes are deliberately in the clear, so they still say which of the
 *  shapes a payload is; everything after the prefix is a hash. */
const parseItemPayload = (
    key: BackupItemKey,
    plaintext: string,
): ParsedItemPayload => {
    if (isContactItemKey(key))
        return { kind: 'contact', payload: parseContactPayload(plaintext) }
    if (isContactRecordKey(key))
        return {
            kind: 'contactRecord',
            payload: parseContactRecordPayload(plaintext),
        }
    if (isPasskeyItemKey(key))
        return { kind: 'passkey', payload: parsePasskeyPayload(plaintext) }
    if (isPasskeySecretsItemKey(key))
        return {
            kind: 'passkeySecrets',
            payload: parsePasskeySecretsPayload(plaintext),
        }
    if (isSettingsItemKey(key))
        return { kind: 'settings', payload: parseSettingsPayload(plaintext) }
    if (isAccountRecordKey(key))
        return { kind: 'record', payload: parseAccountRecordPayload(plaintext) }
    if (key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX))
        return { kind: 'address', payload: parseAddressPayload(plaintext) }
    return { kind: 'secrets', payload: parseSecretsPayload(plaintext) }
}

/** Both maps are keyed on the payload's own address: the item key is an HMAC
 *  of it and cannot be inverted, while an account's address record and its
 *  secrets record repeat the same address, so they still join. */
const collectItemPayloads = (
    items: FetchedItem[],
    encryptionKey: Uint8Array,
    backupId: BackupId,
): CollectedPayloads => {
    const records: AccountRecordPayload[] = []
    const addressPayloads = new Map<string, AddressBackupPayload>()
    const secretsPayloads = new Map<string, SecretsBackupPayload>()
    const contactRecords: ContactRecordPayload[] = []
    const contacts: ContactBackupPayload[] = []
    const passkeyPayloads: PasskeyBackupPayload[] = []
    const passkeySecrets = new Map<string, PasskeySecretsBackupPayload>()
    let settings: Nullable<PulledSettings> = null
    const trackedByKey: Record<BackupItemKey, TrackedIdentifiers> = {}
    const skipped: SkippedItem[] = []

    for (const item of items) {
        const plaintext = decryptItem(item, encryptionKey, backupId)
        if (plaintext === null) {
            skipped.push({ key: item.key, reason: 'decrypt' })
            continue
        }

        let parsed: ParsedItemPayload
        try {
            parsed = parseItemPayload(item.key, plaintext)
        } catch {
            logger.warn('pullBackupItems: failed to parse item', {
                key: item.key,
            })
            skipped.push({ key: item.key, reason: 'parse' })
            continue
        }

        if (parsed.kind === 'settings') {
            settings = { key: item.key, payload: parsed.payload }
            continue
        }

        // A passkey has no address; its credential id is the identifier the
        // review buckets read back out of `trackedByKey`.
        if (parsed.kind === 'passkey') {
            trackedByKey[item.key] = {
                address: parsed.payload.credentialId,
                accountType: null,
            }
            passkeyPayloads.push(parsed.payload)
            continue
        }
        if (parsed.kind === 'passkeySecrets') {
            trackedByKey[item.key] = {
                address: parsed.payload.credentialId,
                accountType: null,
            }
            passkeySecrets.set(parsed.payload.credentialId, parsed.payload)
            continue
        }

        if (parsed.kind === 'record') {
            // Tracked either way, so this device never writes over it.
            trackedByKey[item.key] = recordIdentifiers(parsed.payload)
            if (isAccountRecordReadable(parsed.payload))
                records.push(parsed.payload)
            else skipped.push({ key: item.key, reason: 'newer' })
            continue
        }

        if (parsed.kind === 'contactRecord') {
            // Tracked either way, so this device never writes over it.
            trackedByKey[item.key] = contactRecordIdentifiers(parsed.payload)
            if (isContactRecordReadable(parsed.payload))
                contactRecords.push(parsed.payload)
            else skipped.push({ key: item.key, reason: 'newer' })
            continue
        }

        const { address } = parsed.payload
        if (parsed.kind === 'contact') {
            trackedByKey[item.key] = { address, accountType: null }
            contacts.push(parsed.payload)
        } else {
            trackedByKey[item.key] = {
                address,
                accountType: parsed.payload.type,
            }
            if (parsed.kind === 'address')
                addressPayloads.set(address, parsed.payload)
            else secretsPayloads.set(address, parsed.payload)
        }
    }

    return {
        records,
        addressPayloads,
        secretsPayloads,
        contactRecords,
        contacts,
        passkeys: passkeyPayloads.map(payload => ({
            payload,
            secret: passkeySecrets.get(payload.credentialId) ?? null,
        })),
        settings,
        trackedByKey,
        skipped,
    }
}

export const recordIdentifiers = (
    record: AccountRecordPayload,
): TrackedIdentifiers => ({
    address: record.chains[0]?.address ?? null,
    addresses: accountRecordAddresses(record),
    accountType: accountRecordType(record),
    record,
})

export const contactRecordIdentifiers = (
    record: ContactRecordPayload,
): TrackedIdentifiers => {
    const addresses = contactRecordAddresses(record)
    return {
        address: addresses[0] ?? null,
        addresses,
        accountType: null,
        label: record.name,
        record,
    }
}

/**
 * One contact per record, with the families this build reads, plus each legacy
 * item no record covers. A legacy item a record covers, by address or by the
 * id derived from it, is the same contact written before records existed, so
 * the record wins: the id still matches after the contact's address was
 * edited. A record this build can't read any family of yields no contact, and
 * stays as it is. A legacy item's contact takes the id every device derives
 * for it, so it lands on the contact that device already migrated.
 */
export const buildPulledContacts = ({
    records,
    legacy,
}: {
    records: readonly ContactRecordPayload[]
    legacy: readonly ContactBackupPayload[]
}): PulledContact[] => {
    const coveredAddresses = new Set(records.flatMap(contactRecordAddresses))
    const coveredIds = new Set(records.map(record => record.id))
    return [
        ...records.flatMap(record => {
            const entries = contactRecordEntries(record)
            const removedFamilies = contactRecordRemovedFamilies(record)
            return entries.length === 0
                ? []
                : [
                      {
                          id: record.id,
                          name: record.name,
                          addresses: Object.fromEntries(
                              entries.map(({ family, address }) => [
                                  family,
                                  address,
                              ]),
                          ) as ContactAddresses,
                          ...(removedFamilies.length > 0
                              ? { removedFamilies }
                              : {}),
                      },
                  ]
        }),
        ...legacy.flatMap(({ name, address }) => {
            const addresses = { [LEGACY_CHAIN_FAMILY]: address }
            const id = derivedContactId(addresses)
            return id && !coveredAddresses.has(address) && !coveredIds.has(id)
                ? [{ id, name, addresses }]
                : []
        }),
    ]
}

/**
 * Splits records into one entry per chain this build reads, adds the legacy
 * items no record covers, and joins each to its secret by address. A legacy
 * item a record covers is the same account written before records existed, so
 * the record wins. So a client that predates records can't reach that account:
 * its rename is dropped, and its delete leaves the record live, so the account
 * comes back on the next restore. An hdSeed secret no entry claims (its first
 * account was removed) still surfaces, so the seed restores.
 */
export const buildPulledAccounts = ({
    records,
    addressPayloads,
    secretsPayloads,
}: {
    records: readonly AccountRecordPayload[]
    addressPayloads: ReadonlyMap<string, AddressBackupPayload>
    secretsPayloads: ReadonlyMap<string, SecretsBackupPayload>
}): PulledAccount[] => {
    const covered = new Set(records.flatMap(accountRecordAddresses))
    const entries: {
        group: string
        chain?: ChainId
        payload: AccountEntryPayload
    }[] = [
        ...records.flatMap(record => {
            const group = accountRecordIdentity(record)
            return accountRecordEntries(record, canRestoreRecordEntry).map(
                ({ chain, payload }) => ({
                    group,
                    chain: chain as ChainId,
                    payload,
                }),
            )
        }),
        ...[...addressPayloads.values()]
            .filter(payload => !covered.has(payload.address))
            .map(payload => ({ group: accountIdentityOf(payload), payload })),
    ]
    const accounts: PulledAccount[] = entries.map(
        ({ group, chain, payload }) => ({
            address: payload.address,
            group,
            ...(chain ? { chain } : {}),
            addressPayload: payload,
            secretsPayload: secretsPayloads.get(payload.address) ?? null,
        }),
    )
    const claimed = new Set(accounts.map(account => account.address))
    for (const secretsPayload of secretsPayloads.values()) {
        const { address } = secretsPayload
        if (
            secretsPayload.type === BackupAccountType.hdSeed &&
            !claimed.has(address)
        ) {
            accounts.push({
                address,
                group: address,
                addressPayload: { type: BackupAccountType.hdSeed, address },
                secretsPayload,
            })
        }
    }
    return accounts
}

export const pullBackupItems = async ({
    backupId,
    deviceId,
    encryptionKey,
}: PullBackupItemsParams): Promise<PullBackupItemsResult> => {
    const manifest = await fetchManifest(backupId, deviceId)

    const wantedKeys = selectWantedKeys(manifest.items)
    const items = await readItemsInBatches(backupId, deviceId, wantedKeys)
    const {
        records,
        addressPayloads,
        secretsPayloads,
        contactRecords,
        contacts,
        passkeys,
        settings,
        trackedByKey,
        skipped,
    } = collectItemPayloads(items, encryptionKey, backupId)

    return {
        backupGlobalHash: manifest.backupGlobalHash,
        lastSeq: manifest.lastSeq,
        manifestItems: manifest.items,
        trackedByKey,
        accounts: buildPulledAccounts({
            records,
            addressPayloads,
            secretsPayloads,
        }),
        contacts: buildPulledContacts({
            records: contactRecords,
            legacy: contacts,
        }),
        passkeys,
        settings,
        skipped,
    }
}
