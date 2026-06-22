/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { Key, KeyId, Seed } from '@algorandfoundation/keystore'
import {
    BIP32DerivationType,
    KeyContext,
} from '@algorandfoundation/xhd-wallet-api'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import { buildSeedMetadata } from '../utils'
import { KeyManagementError } from '../errors'
import { useKMSService } from './useKMSServices'
import { prepareHDMasterKey } from '../crypto/prepare-hd-master-key'
import { zeroBytes } from '../crypto/secure-memory'
import { SeedScheme } from '../constants'

export type HDWalletKeyResult = {
    seedKey: Key
}

export const useHDWallet = () => {
    const { keyStore } = useKMSService()

    const createHDWalletKey = async (params?: {
        id?: string
        mnemonic?: string
    }): Promise<HDWalletKeyResult> => {
        const prepared = await prepareHDMasterKey(params)
        return persistHDMasterKey({
            keyId: prepared.keyId,
            rootKey: prepared.rootKey,
            entropy: prepared.entropy,
        })
    }

    const persistHDMasterKey = async (prepared: {
        keyId: string
        rootKey: Uint8Array
        entropy: Uint8Array
    }): Promise<HDWalletKeyResult> => {
        const { keyId, rootKey, entropy } = prepared

        const metadata = buildSeedMetadata({
            scheme: SeedScheme.Bip39,
            entropy,
        })

        try {
            // The seed entry holds the 96-byte XHD root in `privateKey`.
            //
            // `extractable: true` is intentional and required: the root must
            // stay re-exportable to reconstruct the BIP-39 mnemonic for
            // non-custodial backup/recovery (executeWithMnemonic ->
            // withExportedKey in useKMS/useKMSServices). Derived child keys
            // are minted `extractable: false`.
            //
            // The flag is NOT the at-rest protection. Every keystore entry is
            // persisted as AES-256-GCM ciphertext; the symmetric master key
            // lives in the OS keystore (iOS Keychain / Android Keystore), and
            // `keyStore.export` is an internal API gated by `checkAccess` --
            // it is never reachable from dApp/WebView JS. Flipping this to
            // `false` would only break mnemonic recovery, not harden storage.
            //
            // Known hardening gaps tracked as separate work, not regressions
            // of the above: (1) on iOS the passkey-autofill bootstrap mirrors
            // the master key into App-Group UserDefaults so the AutoFill
            // extension can read it, which weakens the at-rest guarantee on
            // that platform (Android wraps the mirrored copy with a hardware
            // Keystore key; iOS stores it unwrapped); (2) `checkAccess` is
            // fail-open for a seed carrying no ACL entries.
            const seed: Omit<Seed, 'id'> & { id: string } = {
                id: keyId,
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                keyUsages: ['deriveKey', 'deriveBits'],
                privateKey: rootKey,
                metadata,
            }

            await keyStore.import(seed, 'raw')
        } finally {
            zeroBytes(rootKey, entropy)
        }

        return {
            seedKey: {
                id: keyId,
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata,
            },
        }
    }

    /**
     * Derives an `hd-derived-ed25519` child of the seed at the given XHD
     * coordinates and persists it to the keystore under a deterministic id
     * (see {@link hdDerivedKeyId}). Repeated calls with the same coords
     * re-use the same entry — the underlying MMKV commit overwrites under
     * the same key. The returned id is what callers persist on
     * `account.keyPairId`.
     */
    const generateDerivedKey = async (
        seedKeyId: KeyId,
        account: number,
        keyIndex: number,
        derivationType: BIP32DerivationType,
    ): Promise<KeyId> => {
        if (!keyStore.deriveFromSeed) {
            throw new KeyManagementError(
                'Keystore backend does not implement deriveFromSeed',
            )
        }
        const path = buildAddressPath(account, keyIndex)
        return keyStore.deriveFromSeed(seedKeyId, path, {
            id: hdDerivedKeyId(seedKeyId, account, keyIndex, derivationType),
            algorithm: 'EdDSA',
            mode:
                derivationType === BIP32DerivationType.Khovratovich
                    ? 'standard'
                    : 'peikert',
            // Stamp the full canonical metadata `signXHDEd25519` reads:
            // `path / context / account / index / derivation`. The
            // rn-keystore happens to set `account`, `context`, and
            // `keyIndex` (NOT `index`) on its own and never sets
            // `derivation`, so without this the signing path silently
            // builds a BIP44 path with `undefined` keyIndex/derivation
            // and the resulting signature fails dApp verification.
            // `rn-keystore.deriveFromSeed` spreads our metadata into
            // the persisted entry first, so every field survives
            // alongside the keystore's own additions.
            metadata: {
                path,
                context: KeyContext.Address,
                account,
                index: keyIndex,
                derivation: derivationType,
            },
        })
    }

    /**
     * Derives an `hd-derived-ed25519` child at the given coords and returns
     * its public-key bytes — used by the HD account-discovery flow to scan
     * candidate addresses without having to commit each one to the account
     * list. The child is persisted as a side effect (under the same
     * deterministic id `generateDerivedKey` would use), which is fine: if
     * the user later commits an account at those coords the id is reused.
     *
     * Reads the publicKey from the live reactive store rather than calling
     * `keyStore.export`: the rn-keystore stamps `extractable: false` on
     * derived keys, so `export` would throw. The reactive snapshot keeps
     * `publicKey` (only `privateKey` gets stripped at commit time), which
     * is all we need here.
     */
    const getDerivedPublicKey = async (
        seedKeyId: KeyId,
        account: number,
        keyIndex: number,
        derivationType: BIP32DerivationType,
    ): Promise<Uint8Array> => {
        const derivedKeyId = await generateDerivedKey(
            seedKeyId,
            account,
            keyIndex,
            derivationType,
        )
        const derived = getKeystoreStore().state.keys.find(
            k => k.id === derivedKeyId,
        )
        if (!derived?.publicKey) {
            throw new KeyManagementError(
                'Derived key does not have a public key',
            )
        }
        return new Uint8Array(derived.publicKey)
    }

    return {
        createHDWalletKey,
        persistHDMasterKey,
        generateDerivedKey,
        getDerivedPublicKey,
    }
}

// BIP44 Algorand address path (coin type 283). The rn-keystore's `parsePath`
// adds the hardened bit (0x80000000) to apostrophe-suffixed components, so
// the raw numbers are passed through here.
const buildAddressPath = (account: number, keyIndex: number): string =>
    `m/44'/283'/${account}'/0/${keyIndex}`

/**
 * Deterministic keystore id for an `hd-derived-ed25519` child of a bip39
 * seed at the given XHD coords. Exported so consumers can compute the id
 * up-front (e.g. account-discovery wants to stamp `account.keyPairId`
 * before the child is actually committed).
 */
export const hdDerivedKeyId = (
    seedKeyId: KeyId,
    account: number,
    keyIndex: number,
    derivationType: BIP32DerivationType,
): string => `${seedKeyId}-acc${account}-idx${keyIndex}-dt${derivationType}`
