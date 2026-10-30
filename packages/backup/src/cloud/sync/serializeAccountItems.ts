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
    hasCustody,
    hdIndexOf,
    standaloneSecretOf,
    type ChainAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Optional, Nullable } from '@perawallet/wallet-core-shared'
import { backupChainAdapters, type BackupHdContext } from '../../chain-adapter'
import {
    ACCOUNT_RECORD_FORMAT_VERSION,
    BackupAccountType,
    orderAccountRecordChains,
    type AccountEntryPayload,
    type AccountRecordChain,
    type AccountRecordPayload,
} from '../models'
import { isBackupChain } from './backupChains'

type BackupChainEntry = { chain: ChainId; entry: ChainAccount }

/** The account's chains this build backs up, in chain-id order. */
const backupChainEntriesOf = (account: WalletAccount): BackupChainEntry[] =>
    orderAccountRecordChains(
        (Object.entries(account.chains) as [ChainId, Optional<ChainAccount>][])
            .filter(
                (pair): pair is [ChainId, ChainAccount] =>
                    pair[1] !== undefined && isBackupChain(pair[0]),
            )
            .map(([chain, entry]) => ({ chain, entry })),
    )

/** The addresses the account is backed up under, in chain-id order; empty
 *  when none of its chains is one this build backs up. */
export const accountBackupAddresses = (account: WalletAccount): string[] =>
    backupChainEntriesOf(account).map(({ entry }) => entry.address)

/** Every address the account holds, whatever the chain. */
export const accountAddressesOf = (account: WalletAccount): string[] => [
    ...new Set(
        Object.values(account.chains)
            .map(entry => entry?.address)
            .filter((address): address is string => !!address),
    ),
]

/** Resolved for an HD account: its seed's reference, and the public key its
 *  entry on the scope chain records (null when it has none there). */
export type RecordHdContext = {
    seedFirstDerivedAddress: string
    publicKeyHex: Nullable<string>
}

/**
 * The entry for a chain with no backup adapter, or for a key held as a raw
 * private key, which no adapter writes as its own kind.
 */
const formatEntry = (
    account: WalletAccount,
    address: string,
    hd: Optional<RecordHdContext>,
): Nullable<AccountEntryPayload> => {
    if (hasCustody(account, 'watch')) {
        return { type: BackupAccountType.watch, address, customName: null }
    }
    if (hasCustody(account, 'hardware')) {
        const { device, accountIndex } = account.custody
        return {
            type: BackupAccountType.hardware,
            address,
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            accountIndex,
            manufacturer: device.manufacturer,
            transportType: device.transportType,
            customName: null,
        }
    }
    if (!hasCustody(account, 'local')) return null
    const index = hdIndexOf(account)
    if (index) {
        return hd
            ? {
                  type: BackupAccountType.hdChain,
                  address,
                  seedFirstDerivedAddress: hd.seedFirstDerivedAddress,
                  account: index.account,
                  keyIndex: index.keyIndex,
                  customName: null,
              }
            : null
    }
    return standaloneSecretOf(account) === 'privateKey'
        ? { type: BackupAccountType.standaloneKey, address, customName: null }
        : null
}

const entryFor = (
    account: WalletAccount,
    { chain, entry }: BackupChainEntry,
    updatedAt: number,
    hd: Optional<RecordHdContext>,
): Nullable<AccountRecordChain> => {
    const adapterContext: Optional<BackupHdContext> =
        hd?.publicKeyHex != null
            ? {
                  seedFirstDerivedAddress: hd.seedFirstDerivedAddress,
                  publicKeyHex: hd.publicKeyHex,
              }
            : undefined
    // A raw private key is the format's own kind on every chain.
    const payload =
        backupChainAdapters.has(chain) &&
        standaloneSecretOf(account) !== 'privateKey'
            ? backupChainAdapters.get(chain).serializeAccount(account, {
                  updatedAt,
                  hd: adapterContext,
              })
            : formatEntry(account, entry.address, hd)
    if (payload === null) return null
    // The record holds the name and timestamp once, for every chain.
    const {
        customName: _customName,
        updatedAt: _updatedAt,
        ...rest
    } = payload as Record<string, unknown> & { type: string; address: string }
    return {
        chain,
        ...rest,
        ...(entry.enabledBy !== undefined
            ? { enabledAt: entry.enabledAt ?? 0, enabledBy: entry.enabledBy }
            : {}),
    }
}

/**
 * The account's record, or null when it has nothing to back up: no chain this
 * build backs up, or an HD account given no seed reference. A chain with a
 * backup adapter writes its own entry, byte-for-byte its legacy item less the
 * name and timestamp; any other chain gets an entry the format owns.
 */
export const buildAccountRecord = (
    account: WalletAccount,
    { updatedAt, hd }: { updatedAt: number; hd?: RecordHdContext },
): Nullable<AccountRecordPayload> => {
    if (hdIndexOf(account) && !hd) return null
    const chains = backupChainEntriesOf(account).flatMap(chainEntry => {
        const entry = entryFor(account, chainEntry, updatedAt, hd)
        return entry ? [entry] : []
    })
    if (chains.length === 0) return null
    return {
        formatVersion: ACCOUNT_RECORD_FORMAT_VERSION,
        customName: account.name ?? null,
        updatedAt,
        chains,
    }
}

/** False when no chain of the account is one this build backs up. */
export const hasBackupChains = (account: WalletAccount): boolean =>
    backupChainEntriesOf(account).length > 0
