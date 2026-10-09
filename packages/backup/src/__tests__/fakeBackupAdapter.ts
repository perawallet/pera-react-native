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

import { vi } from 'vitest'
import type {
    AccountKindId,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { backupChainAdapters, type BackupChainAdapter } from '../chain-adapter'
import {
    BackupAccountType,
    chainBackupKind,
    type AddressBackupPayload,
    type SecretsBackupPayload,
} from '../cloud/models/payloads'

const CHAIN = 'algorand'

/** The fake chain's own item kinds, spelled as the Algorand adapter writes them. */
export const FakeBackupKinds = {
    standalone: chainBackupKind('algo25'),
    quantum: chainBackupKind('quantum'),
    hdAccount: chainBackupKind('hdWallet'),
} as const
// The derivation type every HD item the app writes records today.
const HD_DERIVATION_TYPE = 9

type MultisigNative = {
    multisig?: { version: number; threshold: number; addresses: string[] }
}

const entryOf = (account: WalletAccount) => account.chains[CHAIN]

/** Reproduces the address items the Algorand adapter writes, so specs pin the wire bytes without the chain package. */
export const fakeSerializeAccount: BackupChainAdapter['serializeAccount'] = (
    account,
    { updatedAt, hd },
): AddressBackupPayload | null => {
    const address = entryOf(account)?.address
    if (!address) return null
    const customName = account.name ?? null
    const { custody } = account
    switch (custody.kind) {
        case 'watch':
            return {
                type: BackupAccountType.watch,
                address,
                customName,
                updatedAt,
            }
        case 'hardware':
            return {
                type: BackupAccountType.hardware,
                address,
                deviceId: custody.device.deviceId,
                deviceName: custody.device.deviceName,
                accountIndex: custody.accountIndex,
                manufacturer: custody.device.manufacturer,
                transportType: custody.device.transportType,
                customName,
                updatedAt,
            }
        case 'multisig': {
            const multisig = (
                entryOf(account)?.native as MultisigNative | undefined
            )?.multisig
            if (!multisig) return null
            return {
                type: BackupAccountType.multisig,
                address,
                participantAddresses: multisig.addresses,
                threshold: multisig.threshold,
                version: multisig.version,
                customName,
                updatedAt,
            }
        }
        case 'local': {
            if (custody.seed !== 'bip39') {
                return {
                    type:
                        custody.seed === 'quantum'
                            ? FakeBackupKinds.quantum
                            : FakeBackupKinds.standalone,
                    address,
                    customName,
                    updatedAt,
                }
            }
            if (!hd) return null
            return {
                type: FakeBackupKinds.hdAccount,
                address,
                seedFirstDerivedAddress: hd.seedFirstDerivedAddress,
                publicKey: hd.publicKeyHex,
                account: custody.hd.account,
                change: 0,
                keyIndex: custody.hd.keyIndex,
                derivationType: HD_DERIVATION_TYPE,
                customName,
                updatedAt,
            }
        }
        default:
            return null
    }
}

export const fakeLocalKindOf: BackupChainAdapter['localKindOf'] = type => {
    switch (type) {
        case FakeBackupKinds.standalone:
            return { seed: null, isHd: false }
        case FakeBackupKinds.quantum:
            return { seed: 'quantum', isHd: false }
        case FakeBackupKinds.hdAccount:
            return { seed: 'bip39', isHd: true }
        default:
            return undefined
    }
}

// The wire kinds double as the fake chain's presentation kind ids.
export const fakeKindIdOf: BackupChainAdapter['kindIdOf'] = type =>
    // A type-only cast: a value import here would load the accounts module
    // before a spec's hoisted mock of it can see its own variables.
    type === BackupAccountType.hdSeed ? undefined : (type as AccountKindId)

export const fakeSerializeMnemonicSecret: BackupChainAdapter['serializeMnemonicSecret'] =
    (account, mnemonic): SecretsBackupPayload | null => {
        const address = entryOf(account)?.address
        const { custody } = account
        if (!address || custody.kind !== 'local' || custody.seed === 'bip39') {
            return null
        }
        return {
            type:
                custody.seed === 'quantum'
                    ? FakeBackupKinds.quantum
                    : FakeBackupKinds.standalone,
            mnemonic,
            address,
        }
    }

export const fakeMnemonicBackupKeyId: BackupChainAdapter['mnemonicBackupKeyId'] =
    account =>
        account.custody.kind === 'local'
            ? (entryOf(account)?.keyPairId ?? null)
            : null

export const fakeBackupAdapter = (
    overrides: Partial<BackupChainAdapter> = {},
): BackupChainAdapter => ({
    chainId: CHAIN,
    seedReference: vi.fn(async (_kms, seedKeyId: string) => `REF-${seedKeyId}`),
    deriveHdAccount: vi.fn(async (_kms, seedKeyId, details) => ({
        keyPairId: `${seedKeyId}/${details.account}/${details.keyIndex}/${details.derivationType}`,
        publicKey: new Uint8Array([details.account, details.keyIndex]),
        address: `ADDR-${details.account}-${details.keyIndex}`,
    })),
    serializeAccount: vi.fn(fakeSerializeAccount),
    localKindOf: vi.fn(fakeLocalKindOf),
    kindIdOf: vi.fn(fakeKindIdOf),
    serializeMnemonicSecret: vi.fn(fakeSerializeMnemonicSecret),
    mnemonicBackupKeyId: vi.fn(fakeMnemonicBackupKeyId),
    useImportFromSeed: vi.fn(() => vi.fn()),
    secureBackup: {
        parseEnvelope: vi.fn(),
        decryptPayload: vi.fn(),
        partitionImportable: vi.fn(),
        useImportAccount: vi.fn(() => vi.fn()),
    },
    ...overrides,
})

/** Registers a fresh fake as the only backup adapter. */
export const registerFakeBackupAdapter = (
    overrides: Partial<BackupChainAdapter> = {},
): BackupChainAdapter => {
    const adapter = fakeBackupAdapter(overrides)
    backupChainAdapters.reset()
    backupChainAdapters.register(adapter)
    return adapter
}
