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

import { AlgorandClient, microAlgo } from '@algorandfoundation/algokit-utils'
import type { KeyId, KeyStore } from '@algorandfoundation/keystore-core'
import {
    BIP32DerivationType,
    fromSeed,
    KeyContext,
} from '@algorandfoundation/xhd-wallet-api'
import { generateMnemonic, mnemonicToSeed } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import algosdk from 'algosdk'
import nacl from 'tweetnacl'

import { derivePQKeygenSeed } from '@perawallet/wallet-core-blockchain/pq/derivation'
import { deriveQuantumAddress } from '@perawallet/wallet-core-blockchain/pq/quantumAdapter'

export type ConformanceAccountKind = 'algo25' | 'hd' | 'quantum'

export type ConformanceAccount = {
    address: string
    /** algo25 25-word phrase for `algo25`/`quantum`; BIP39 24-word phrase for `hd`. */
    mnemonic: string
    /** The keystore id that signs for {@link address}. */
    keyId: KeyId
    kind: ConformanceAccountKind
}

export type ConformanceMultisigAccount = {
    address: string
    members: ConformanceAccount[]
    threshold: number
    version: number
}

/** BIP39 entropy strength the app mints HD wallets with (a 24-word phrase). */
const HD_MNEMONIC_STRENGTH = 256

/** Every conformance HD account lives under BIP44 account 0, as the app's do. */
const HD_ACCOUNT = 0

// BIP44 Algorand address path (coin type 283), byte-for-byte the app's
// `buildAddressPath` in packages/kms/src/hooks/useHDWallet.ts.
export const buildHdAddressPath = (account: number, keyIndex: number): string =>
    `m/44'/283'/${account}'/0/${keyIndex}`

const randomAlgo25Mnemonic = (): string =>
    algosdk.secretKeyToMnemonic(algosdk.generateAccount().sk)

/**
 * Imports an algo25 mnemonic's 32 bytes of entropy as an extractable `seed`
 * record. Both the ed25519 signing key and the Falcon key hang off this record
 * as their `parentKeyId`, mirroring how the app roots an algo25 account.
 */
const importAlgo25Seed = async (
    keyStore: KeyStore<void>,
    id: KeyId,
    seed: Uint8Array,
): Promise<KeyId> =>
    keyStore.import(
        {
            id,
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            keyUsages: ['deriveKey', 'deriveBits'],
            privateKey: Uint8Array.from(seed),
            metadata: { scheme: 'algo25' },
        },
        'raw',
    )

export const createAlgo25Account = async (
    keyStore: KeyStore<void>,
    mnemonic: string = randomAlgo25Mnemonic(),
): Promise<ConformanceAccount> => {
    const id = crypto.randomUUID()
    const seed = algosdk.seedFromMnemonic(mnemonic)
    await importAlgo25Seed(keyStore, `${id}-seed`, seed)

    const { publicKey } = nacl.sign.keyPair.fromSeed(Uint8Array.from(seed))
    const keyId = await keyStore.import(
        {
            id: `${id}-sign`,
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            keyUsages: ['sign', 'verify'],
            // The 32-byte Ed25519 seed, not the 64-byte expanded secret key.
            privateKey: Uint8Array.from(seed),
            publicKey: Uint8Array.from(publicKey),
            metadata: { parentKeyId: `${id}-seed` },
        },
        'raw',
    )
    seed.fill(0)

    return {
        address: algosdk.encodeAddress(publicKey),
        mnemonic,
        keyId,
        kind: 'algo25',
    }
}

export const createQuantumAccount = async (
    keyStore: KeyStore<void>,
    mnemonic: string = randomAlgo25Mnemonic(),
): Promise<ConformanceAccount> => {
    const id = crypto.randomUUID()
    const seed = algosdk.seedFromMnemonic(mnemonic)
    await importAlgo25Seed(keyStore, `${id}-seed`, seed)

    const keygenSeed = derivePQKeygenSeed(seed, 'falcon1024')
    seed.fill(0)
    const keyId = await keyStore.generate({
        type: 'falcon-1024',
        algorithm: 'Falcon-1024',
        extractable: false,
        keyUsages: ['sign', 'verify'],
        params: {
            seed: Uint8Array.from(keygenSeed),
            parentKeyId: `${id}-seed`,
            id: `${id}-quantum`,
            pqDerivation: 'pqk1',
        },
    })
    keygenSeed.fill(0)

    const { publicKey } = await keyStore.export(keyId)
    if (!publicKey) throw new Error(`quantum key ${keyId} has no public key`)

    return {
        address: deriveQuantumAddress(publicKey),
        mnemonic,
        keyId,
        kind: 'quantum',
    }
}

export const createHdAccount = async (
    keyStore: KeyStore<void>,
    mnemonic: string = generateMnemonic(wordlist, HD_MNEMONIC_STRENGTH),
    index = 0,
): Promise<ConformanceAccount> => {
    if (!keyStore.deriveFromSeed) {
        throw new Error('keystore does not implement deriveFromSeed')
    }

    const id = crypto.randomUUID()
    const bip39Seed = await mnemonicToSeed(mnemonic)
    // The 96-byte XHD extended root (kL || kR || chainCode), not the BIP39
    // seed: `deriveFromSeed` injects these bytes straight into the
    // BIP32-Ed25519 shim and rejects any parent not typed `hd-root-key`.
    const rootKey = fromSeed(Buffer.from(bip39Seed))
    bip39Seed.fill(0)

    const rootKeyId = await keyStore.import(
        {
            id: `${id}-root`,
            type: 'hd-root-key',
            algorithm: 'raw',
            extractable: false,
            keyUsages: ['deriveKey', 'deriveBits'],
            privateKey: rootKey,
            metadata: { scheme: 'bip39' },
        },
        'raw',
    )
    rootKey.fill(0)

    const path = buildHdAddressPath(HD_ACCOUNT, index)
    const keyId = await keyStore.deriveFromSeed(rootKeyId, path, {
        id: `${id}-idx${index}`,
        algorithm: 'EdDSA',
        mode: 'peikert',
        // The full coordinate set the app's signing path reads back off the
        // record; without it the BIP44 path is rebuilt with undefined segments.
        metadata: {
            path,
            context: KeyContext.Address,
            account: HD_ACCOUNT,
            index,
            derivation: BIP32DerivationType.Peikert,
        },
    })

    const { publicKey } = await keyStore.export(keyId)
    if (!publicKey) throw new Error(`derived key ${keyId} has no public key`)

    return {
        address: algosdk.encodeAddress(publicKey),
        mnemonic,
        keyId,
        kind: 'hd',
    }
}

/**
 * The multisig address for `members` in the order given — order is part of the
 * preimage, so it is part of the address.
 */
export const createMultisigAccount = (
    members: ConformanceAccount[],
    threshold: number,
): ConformanceMultisigAccount => {
    const version = 1
    return {
        address: algosdk
            .multisigAddress({
                version,
                threshold,
                addrs: members.map(member => member.address),
            })
            .toString(),
        members,
        threshold,
        version,
    }
}

export const fundAccount = async (
    address: string,
    microAlgos: bigint,
): Promise<void> => {
    // The dispenser is a LocalNet-only KMD account, so this one client is built
    // by algokit's own LocalNet factory rather than the app's.
    const algorand = AlgorandClient.defaultLocalNet()
    const dispenser = await algorand.account.localNetDispenser()
    await algorand.send.payment({
        sender: dispenser.addr,
        receiver: address,
        amount: microAlgo(microAlgos),
    })
}
