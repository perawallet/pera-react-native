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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'
import {
    parseAccountRecordPayload,
    parseAddressPayload,
    parseSecretsPayload,
} from '../api/payloadParsers'
import {
    isAccountItemKey,
    isAccountRecordKey,
    isAccountRecordReadable,
    type AccountRecordPayload,
    type AddressBackupPayload,
    type BackupItemKey,
    type FetchedItem,
    type SecretsBackupPayload,
    type SyncItemState,
} from '../models'
import {
    buildPulledAccounts,
    recordIdentifiers,
    type PulledAccount,
} from '../restore'
import { isBackupChain } from './backupChains'
import {
    adoptRemote,
    decryptItem,
    isLocalNewer,
    keepLocalEdit,
    seenOnly,
    type CollectPayloadsDeps,
} from './collectPayloads'

type ParsedAccountPayload =
    | { kind: 'record'; payload: AccountRecordPayload }
    | { kind: 'address'; payload: AddressBackupPayload }
    | { kind: 'secrets'; payload: SecretsBackupPayload }

const parseAccountPayload = (
    key: BackupItemKey,
    plaintext: string,
): ParsedAccountPayload => {
    if (isAccountRecordKey(key))
        return { kind: 'record', payload: parseAccountRecordPayload(plaintext) }
    if (isAccountItemKey(key))
        return { kind: 'address', payload: parseAddressPayload(plaintext) }
    return { kind: 'secrets', payload: parseSecretsPayload(plaintext) }
}

/** `items` is mutated in place: each readable item's version/hash bookkeeping
 *  is written back under its own key. */
export const collectAccountPayloads = ({
    fetched,
    items,
    deps,
}: {
    fetched: FetchedItem[]
    items: Record<BackupItemKey, SyncItemState>
    deps: CollectPayloadsDeps
}): PulledAccount[] => {
    const records: AccountRecordPayload[] = []
    const addressPayloads = new Map<string, AddressBackupPayload>()
    const secretsPayloads = new Map<string, SecretsBackupPayload>()

    for (const item of fetched) {
        const plaintext = decryptItem(item, deps)
        if (plaintext === null) continue

        let parsed: ParsedAccountPayload
        try {
            parsed = parseAccountPayload(item.key, plaintext)
        } catch {
            logger.warn('collectAccountPayloads: failed to parse', {
                key: item.key,
            })
            continue
        }

        const existing = items[item.key]
        if (parsed.kind === 'record') {
            const identifiers = recordIdentifiers(parsed.payload)
            // A newer client's record: tracked, never imported or overwritten,
            // so a local edit waiting to push is dropped.
            if (!isAccountRecordReadable(parsed.payload)) {
                items[item.key] = {
                    ...seenOnly(existing, item, identifiers),
                    isDirty: false,
                }
                continue
            }
            // Only the record carries an editable name; a secret is immutable,
            // so there is no local edit for it to win. The remote content is
            // still cached, so the edit's push keeps what it added.
            if (existing && isLocalNewer(existing, plaintext)) {
                items[item.key] = {
                    ...keepLocalEdit(existing, item),
                    ...identifiers,
                }
                continue
            }
            // A held one waits for the user to add it back.
            if (existing?.pendingImport === true) {
                items[item.key] = seenOnly(existing, item, identifiers)
                continue
            }
            records.push(parsed.payload)
            items[item.key] = {
                ...adoptRemote(existing as SyncItemState, item, plaintext),
                ...identifiers,
                // A new remote version earns its own attempts.
                importFailures:
                    existing?.lastRemoteHash === item.hash
                        ? existing.importFailures
                        : undefined,
            }
            continue
        }

        if (
            parsed.kind === 'address' &&
            existing &&
            isLocalNewer(existing, plaintext)
        ) {
            items[item.key] = keepLocalEdit(existing, item)
            continue
        }

        const { address, type } = parsed.payload

        // Left unread rather than adopted, so the first sync after this
        // client can read the chain picks it up.
        const chain =
            'chain' in parsed.payload ? (parsed.payload.chain as ChainId) : null
        if (chain !== null && !isBackupChain(chain)) {
            items[item.key] = {
                ...(items[item.key] as SyncItemState),
                localContentHash: null,
            }
            continue
        }

        // Cached but not imported: the user deleted this account here on
        // purpose, and only the review row needs it back.
        if (existing?.pendingImport === true) {
            items[item.key] = seenOnly(existing, item, {
                address,
                accountType: type,
            })
            continue
        }

        if (parsed.kind === 'address')
            addressPayloads.set(address, parsed.payload)
        else secretsPayloads.set(address, parsed.payload)

        items[item.key] = {
            ...adoptRemote(items[item.key] as SyncItemState, item, plaintext),
            address,
            accountType: type,
            importFailures:
                existing?.lastRemoteHash === item.hash
                    ? existing.importFailures
                    : undefined,
        }
    }

    // Join records, legacy items and secrets, and surface orphan hdSeed
    // secrets as standalone entries — shared with the full-restore path so the
    // incremental/realtime sync path restores HD seeds whose first account was
    // removed.
    return buildPulledAccounts({ records, addressPayloads, secretsPayloads })
}
