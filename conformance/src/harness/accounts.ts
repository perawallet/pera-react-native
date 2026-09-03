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
    KeyContext,
} from '@algorandfoundation/xhd-wallet-api'
import algosdk from 'algosdk'

// Deep imports rather than the package barrel on purpose: the barrel pulls
// in every accounts hook (multisig, staking, currencies), none of which is
// reachable from a Node suite. `models/accounts` and `bip44` have no
// dependencies beyond types and one error class.
import {
    AccountTypes,
    DerivationTypes,
    type Algo25Account,
    type HDWalletAccount,
    type HDWalletDetails,
    type MultiSigAccount,
    type QuantumAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts/models/accounts'
import { assertAlgorandBip44PathMatches } from '@perawallet/wallet-core-accounts/bip44'
import { derivePQKeygenSeed } from '@perawallet/wallet-core-blockchain/pq/derivation'
import { deriveQuantumAddress } from '@perawallet/wallet-core-blockchain/pq/quantumAdapter'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain/utils/addresses'
import { generateMultisigAddress } from '@perawallet/wallet-core-blockchain/utils/multisig'
import { entropyToMnemonic } from '@perawallet/wallet-core-kms/crypto/hdwallet-utils'
import { mnemonicWordsToIndices } from '@perawallet/wallet-core-kms/crypto/mnemonic-indices'
import { prepareHDMasterKey } from '@perawallet/wallet-core-kms/crypto/prepare-hd-master-key'
import { algo25SeedToAddress } from '@perawallet/wallet-core-kms/utils'

export type ConformanceAccountKind = 'algo25' | 'hd' | 'quantum'

export type ConformanceAccount = {
    address: string
    /** algo25 25-word phrase for `algo25`/`quantum`; BIP39 24-word phrase for `hd`. */
    mnemonic: string
    /** The keystore id that signs for {@link address}. */
    keyId: KeyId
    kind: ConformanceAccountKind
    /**
     * The app's own account model for this key. Suites hand this to real app
     * code (`signTransactionsWithLocalKey`, `resolveSigningAccount`,
     * `buildGroupSignerTypeMap`) rather than to a harness stand-in, so the
     * type-dispatch those functions perform is the dispatch under test.
     */
    walletAccount: WalletAccount
}

export type ConformanceMultisigAccount = {
    address: string
    members: ConformanceAccount[]
    threshold: number
    version: number
    walletAccount: MultiSigAccount
}

/** Every conformance HD account lives under BIP44 account 0, as the app's do. */
const HD_ACCOUNT = 0

// BIP44 Algorand address path (coin type 283), byte-for-byte the app's
// `buildAddressPath` in packages/kms/src/hooks/useHDWallet.ts. That one is
// module-private, so the path is rebuilt here and then checked against the
// app's own parser below rather than trusted.
export const buildHdAddressPath = (account: number, keyIndex: number): string =>
    `m/44'/283'/${account}'/0/${keyIndex}`

const randomAlgo25Mnemonic = (): string =>
    algosdk.secretKeyToMnemonic(algosdk.generateAccount().sk)

/**
 * Imports an algo25 mnemonic's 32 bytes of entropy as an extractable `seed`
 * record. Both the ed25519 signing key and the Falcon key hang off this record
 * as their `parentKeyId`, mirroring how the app roots an algo25 account —
 * the `scheme` metadata is what `resolvePQSigningInfo` reads to decide which
 * signature scheme a child signs under, so it is load-bearing, not decoration.
 */
const importSeed = async (
    keyStore: KeyStore<void>,
    id: KeyId,
    seed: Uint8Array,
    scheme: 'algo25' | 'quantum',
): Promise<KeyId> =>
    keyStore.import(
        {
            id,
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            keyUsages: ['deriveKey', 'deriveBits'],
            privateKey: Uint8Array.from(seed),
            metadata: { scheme },
        },
        'raw',
    )

export const createAlgo25Account = async (
    keyStore: KeyStore<void>,
    mnemonic: string = randomAlgo25Mnemonic(),
): Promise<ConformanceAccount> => {
    const id = crypto.randomUUID()
    const seed = algosdk.seedFromMnemonic(mnemonic)
    await importSeed(keyStore, `${id}-seed`, seed, 'algo25')

    // The app's own seed→address derivation, so a change to it fails here
    // rather than agreeing with a harness copy of the old behaviour.
    const address = algo25SeedToAddress(seed)
    const keyId = await keyStore.import(
        {
            id: `${id}-sign`,
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            keyUsages: ['sign', 'verify'],
            // The 32-byte Ed25519 seed, not the 64-byte expanded secret key.
            privateKey: Uint8Array.from(seed),
            publicKey: algosdk.Address.fromString(address).publicKey,
            metadata: { parentKeyId: `${id}-seed` },
        },
        'raw',
    )
    seed.fill(0)

    return {
        address,
        mnemonic,
        keyId,
        kind: 'algo25',
        walletAccount: {
            id,
            type: AccountTypes.algo25,
            address,
            keyPairId: keyId,
        } satisfies Algo25Account,
    }
}

export const createQuantumAccount = async (
    keyStore: KeyStore<void>,
    mnemonic: string = randomAlgo25Mnemonic(),
): Promise<ConformanceAccount> => {
    const id = crypto.randomUUID()
    const seed = algosdk.seedFromMnemonic(mnemonic)
    await importSeed(keyStore, `${id}-seed`, seed, 'quantum')

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

    const address = deriveQuantumAddress(publicKey)

    return {
        address,
        mnemonic,
        keyId,
        kind: 'quantum',
        walletAccount: {
            id,
            type: AccountTypes.quantum,
            address,
            keyPairId: keyId,
        } satisfies QuantumAccount,
    }
}

export const createHdAccount = async (
    keyStore: KeyStore<void>,
    mnemonic?: string,
    index = 0,
): Promise<ConformanceAccount> => {
    if (!keyStore.deriveFromSeed) {
        throw new Error('keystore does not implement deriveFromSeed')
    }

    const id = crypto.randomUUID()
    // Throw, don't fall through: passing undefined for a bad phrase would
    // silently mint a random wallet, and the suite would then "verify" it.
    let mnemonicIndices: Uint16Array | undefined
    if (mnemonic !== undefined) {
        const indices = mnemonicWordsToIndices(mnemonic.split(' '))
        if (!indices) {
            throw new Error('HD mnemonic contains non-wordlist words')
        }
        mnemonicIndices = indices
    }
    // The app's own BIP39→XHD-root preparation. It deliberately does not hand
    // back the phrase (heap hygiene), so the phrase is recovered from the
    // entropy it does return — again through the app's own helper.
    const prepared = await prepareHDMasterKey({
        id: `${id}-root`,
        mnemonicIndices,
    })
    const resolvedMnemonic = mnemonic ?? entropyToMnemonic(prepared.entropy)
    prepared.entropy.fill(0)

    const rootKeyId = await keyStore.import(
        {
            id: prepared.keyId,
            type: 'hd-root-key',
            algorithm: 'raw',
            extractable: false,
            keyUsages: ['deriveKey', 'deriveBits'],
            // The 96-byte XHD extended root (kL || kR || chainCode), not the
            // BIP39 seed: `deriveFromSeed` injects these bytes straight into
            // the BIP32-Ed25519 shim and rejects any parent not typed
            // `hd-root-key`.
            privateKey: prepared.rootKey,
            metadata: { scheme: 'bip39' },
        },
        'raw',
    )
    prepared.rootKey.fill(0)

    const hdWalletDetails: HDWalletDetails = {
        account: HD_ACCOUNT,
        change: 0,
        keyIndex: index,
        derivationType: DerivationTypes.Peikert,
    }
    const path = buildHdAddressPath(HD_ACCOUNT, index)
    // The app's own BIP44 parser is the judge of whether the path this harness
    // built is the path the app would have derived at these coordinates.
    assertAlgorandBip44PathMatches(path, hdWalletDetails)

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

    const address = encodeAlgorandAddress(publicKey)

    return {
        address,
        mnemonic: resolvedMnemonic,
        keyId,
        kind: 'hd',
        walletAccount: {
            id,
            type: AccountTypes.hdWallet,
            address,
            keyPairId: keyId,
            hdWalletDetails,
        } satisfies HDWalletAccount,
    }
}

/**
 * The multisig address for `members` in the order given — order is part of the
 * preimage, so it is part of the address. Computed with the app's own
 * `generateMultisigAddress`, which is the only multisig-address computation
 * site in the codebase outside algosdk itself.
 */
export const createMultisigAccount = (
    members: ConformanceAccount[],
    threshold: number,
): ConformanceMultisigAccount => {
    const version = 1
    const addresses = members.map(member => member.address)
    const address = generateMultisigAddress(version, threshold, addresses)

    return {
        address,
        members,
        threshold,
        version,
        walletAccount: {
            id: address,
            type: AccountTypes.multisig,
            address,
            multisigDetails: { threshold, addresses, version },
        } satisfies MultiSigAccount,
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
