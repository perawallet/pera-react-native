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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import * as secp from '@noble/secp256k1'
import { sha256 } from '@noble/hashes/sha2.js'

// The restore reads the device's seeds through `useKMS`; the keys and signing
// below go through the real KMS core over a secp256k1 keystore double.
const { persistHDMasterKeyMock, heldSeeds } = vi.hoisted(() => ({
    persistHDMasterKeyMock: vi.fn(),
    heldSeeds: { value: new Map<string, unknown>() },
}))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-kms')>()),
    useKMS: () => ({
        keys: heldSeeds.value,
        hasSeedWithEntropy: () => false,
        persistHDMasterKey: persistHDMasterKeyMock,
    }),
}))

import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { revealEthereumPrivateKey } from '@perawallet/wallet-core-chain-ethereum'
import { ethereumModule } from '@perawallet/wallet-core-chain-ethereum'
import {
    BACKUP_ACCESS_DOMAIN,
    SIGNING_ACCESS_DOMAIN,
    hexToBytes,
    kmsCore,
} from '@perawallet/wallet-core-kms'
import { createKmsCore } from '@perawallet/wallet-core-kms/create-kms-core'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { backupChainAdapters } from '../../../chain-adapter'
import {
    HARDHAT_0_ADDRESS,
    HARDHAT_0_KEY_HEX,
    registerAlgorandAccountsAdapter,
} from '../../../__tests__/backupChainFixtures'
import { fakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'
import {
    createSecp256k1TestKeyStore,
    testKeystore,
} from '../../../__tests__/secp256k1TestKeyStore'
import {
    parseAccountRecordPayload,
    parseSecretsPayload,
} from '../../api/payloadParsers'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import { isAccountRecordKey } from '../../models'
import { buildPulledAccounts } from '../../restore/pullBackupItems'
import { canonicalJson } from '../../sync/canonicalize'
import { serializeAccountForBackup } from '../../sync/serializeAccountForBackup'
import type { SerializedItem } from '../../sync/types'
import { useCloudBackupImport } from '../useCloudBackupImport'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))
const DIGEST = sha256(new TextEncoder().encode('restored key signs'))
const ETH_HD_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const WATCH_ADDRESS = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

const store = () => useAccountsStore.getState()

/** Whatever the sync engine would have pushed and the restore would pull back. */
const throughTheWire = (accounts: WalletAccount[], hdFirstAddress: string) =>
    Promise.all(
        accounts.map(account =>
            serializeAccountForBackup(account, {
                chainId: 'algorand',
                updatedAt: 1,
                hashAddress,
                resolveHd: async () => ({
                    seedFirstDerivedAddress: hdFirstAddress,
                    publicKeyHex: '01',
                    seedHex: 'aa'.repeat(96),
                    entropyHex: 'bb'.repeat(32),
                }),
                resolvePrivateKey: async (_chainId, keyPairId) => {
                    const { exportSecp256k1Key } = createKmsCore({
                        keyStore: () => testKeystore.store!,
                        keys: () => testKeystore.store!.state.keys,
                    })
                    return revealEthereumPrivateKey(
                        { exportSecp256k1Key } as never,
                        keyPairId,
                        BACKUP_ACCESS_DOMAIN,
                    )
                },
            }),
        ),
    ).then(serialized => {
        const records: ReturnType<typeof parseAccountRecordPayload>[] = []
        const secrets = new Map<
            string,
            ReturnType<typeof parseSecretsPayload>
        >()
        const items = serialized.flatMap(result =>
            result
                ? [
                      result.record,
                      ...(result.secrets ? [result.secrets] : []),
                      ...(result.extraItems ?? []),
                  ]
                : [],
        )
        for (const item of items as SerializedItem[]) {
            const wire = canonicalJson(item.payload)
            if (isAccountRecordKey(item.key)) {
                records.push(parseAccountRecordPayload(wire))
            } else {
                const payload = parseSecretsPayload(wire)
                secrets.set(payload.address, payload)
            }
        }
        return buildPulledAccounts({
            records,
            addressPayloads: new Map(),
            secretsPayloads: secrets,
        })
    })

describe('chain accounts through serialize and restore', () => {
    beforeEach(() => {
        ethereumModule.register({} as never)
        getProvider().chains.register(
            ethereumModule.descriptor,
            ethereumModule.capabilityDefaults,
        )
        registerAlgorandAccountsAdapter()
        backupChainAdapters.reset()
        backupChainAdapters.register(
            fakeBackupAdapter({
                seedReference: async () => 'FIRST',
                deriveHdAccount: async () => ({
                    keyPairId: 'derived-algorand',
                    publicKey: new Uint8Array([1]),
                    address: 'ALGO-CHILD',
                }),
            }),
        )
        heldSeeds.value = new Map()
        persistHDMasterKeyMock.mockReset()
        testKeystore.store = createSecp256k1TestKeyStore()
        store().resetState()
    })

    test('an Algorand+Ethereum HD account, an imported and a watched Ethereum account come back as one account each with the same addresses and names, and the imported key signs the same', async () => {
        // Device A: the imported account goes through the real store and KMS.
        const imported = await store().importAccountFromPrivateKey(
            'ethereum',
            hexToBytes(HARDHAT_0_KEY_HEX),
            'Imported',
        )
        const importedKeyPairId = imported.chains!.ethereum!.keyPairId!
        const signatureBefore = await kmsCore.sign(
            importedKeyPairId,
            DIGEST,
            SIGNING_ACCESS_DOMAIN,
        )
        const hd = {
            id: 'hd',
            name: 'Child',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 1 },
            },
            chains: {
                algorand: {
                    address: 'ALGO-CHILD',
                    keyPairId: 'derived-algorand',
                },
                ethereum: { address: ETH_HD_ADDRESS, keyPairId: 'eth-hd' },
            },
        } as unknown as WalletAccount
        const watch = {
            id: 'watch',
            name: 'Watched',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: WATCH_ADDRESS } },
        } as unknown as WalletAccount
        const pulled = await throughTheWire([hd, imported, watch], 'FIRST')

        // Device B: nothing held, a fresh keystore.
        store().resetState()
        testKeystore.store = createSecp256k1TestKeyStore()
        // What the store does for a position it already holds: add the chain
        // to that account. The real derivation needs the seed in the keystore.
        const addChainAccount = vi.fn(async () => {
            const holder = store().accounts.find(a => a.name === 'Child')!
            const account = {
                ...holder,
                chains: {
                    ...holder.chains,
                    ethereum: { address: ETH_HD_ADDRESS, keyPairId: 'eth-hd' },
                },
            } as WalletAccount
            useAccountsStore.setState({
                accounts: store().accounts.map(a =>
                    a.id === holder.id ? account : a,
                ),
            })
            return account
        })
        useAccountsStore.setState({ addChainAccount })
        const { result } = renderHook(() =>
            useCloudBackupImport({ chainId: 'algorand', networkId: 'mainnet' }),
        )

        const summary = await result.current.importAccounts(pulled)

        expect(summary).toEqual({
            imported: 3,
            skippedDuplicate: 0,
            failed: [],
        })
        expect(addChainAccount).toHaveBeenCalledWith(
            expect.any(String),
            'ethereum',
            { account: 0, keyIndex: 1 },
            'Child',
            ETH_HD_ADDRESS,
        )
        const restored = store().accounts
        const restoredImported = restored.find(a => a.name === 'Imported')
        expect(restoredImported?.chains?.ethereum?.address.toLowerCase()).toBe(
            HARDHAT_0_ADDRESS.toLowerCase(),
        )
        expect(restored.find(a => a.name === 'Watched')?.chains).toEqual({
            ethereum: { address: WATCH_ADDRESS },
        })
        const child = restored.filter(a => a.name === 'Child')
        expect(child).toHaveLength(1)
        expect(child[0]?.chains).toMatchObject({
            algorand: { address: 'ALGO-CHILD' },
            ethereum: { address: ETH_HD_ADDRESS },
        })

        // The restored key is the same key: it signs the same digest to the
        // same bytes (RFC 6979) and the signature verifies under its public key.
        const restoredKeyPairId = restoredImported!.chains!.ethereum!.keyPairId!
        const signatureAfter = await kmsCore.sign(
            restoredKeyPairId,
            DIGEST,
            SIGNING_ACCESS_DOMAIN,
        )
        expect(signatureAfter).toEqual(signatureBefore)
        const publicKey = testKeystore.store!.state.keys.find(
            key => key.id === restoredKeyPairId,
        )!.publicKey!
        expect(
            secp.verify(signatureAfter.subarray(0, 64), DIGEST, publicKey, {
                prehash: false,
            }),
        ).toBe(true)
    })
})
