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
    AccountError,
    buildAccount,
    DuplicateAccountError,
    type AlternateImportKind,
    type LocalKeySeed,
    type MintedAccount,
    type SingleKeyAccountOps,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    algo25PublicKeyFromSeed,
    algo25SignKeyId,
    indicesToAlgo25Seed,
    kmsCore,
    PQ_DERIVATION_CANONICAL,
    quantumAddressCandidates,
    quantumSignKeyId,
    SeedScheme,
    zeroBytes,
    type QuantumAddressCandidate,
} from '@perawallet/wallet-core-kms'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandNetworkOf } from '../legacy-network'
import { algorandAddressCodec } from './address-codec'
import { algorandAccountExists } from './discovery'
import { algorandQuantumDerivation, quantumNative } from './quantum'

type Save = (minted: MintedAccount) => Promise<void>

const ed25519Address = (publicKey: Uint8Array, scope: ChainScope): string =>
    algorandAddressCodec.fromPublicKey(publicKey, {
        scheme: 'ed25519',
        networkId: scope.networkId,
    })

const createAlgo25 = async (
    scope: ChainScope,
    id?: string,
): Promise<MintedAccount> => {
    const keyId = id ?? generateOrderedUniqueId()
    const existing = kmsCore.getKey(keyId)
    let seedKeyId: string
    let publicKey: Uint8Array
    let isNewSeed = false
    if (existing) {
        seedKeyId = existing.id
        publicKey = existing.publicKey ?? new Uint8Array()
    } else {
        const result = await kmsCore.createAlgo25Key({ id: keyId })
        seedKeyId = result.seedKey.id
        publicKey = result.publicKey
        isNewSeed = true
    }

    try {
        return {
            account: buildAccount({
                custody: { kind: 'local', seed: null },
                chainId: ALGORAND_CHAIN_ID,
                chains: {
                    [ALGORAND_CHAIN_ID]: {
                        address: ed25519Address(publicKey, scope),
                        keyPairId: algo25SignKeyId(seedKeyId),
                    },
                },
            }),
            seedKeyId,
            isNewSeed,
        }
    } catch (error) {
        if (isNewSeed) {
            await kmsCore.discardMintedSeed(seedKeyId).catch(() => {})
        }
        throw error
    }
}

// Unlike algo25 there is no getKey(id) reuse branch: a quantum seed entry
// carries no derivable public key at this layer (the signing child holds it,
// inside the KMS), so a bare `id` goes straight to createQuantumKey.
const createQuantum = async (id?: string): Promise<MintedAccount> => {
    const result = await kmsCore.createQuantumKey({
        id,
        chain: algorandQuantumDerivation,
    })
    try {
        return {
            account: buildAccount({
                custody: { kind: 'local', seed: 'quantum' },
                chainId: ALGORAND_CHAIN_ID,
                chains: {
                    [ALGORAND_CHAIN_ID]: {
                        address: result.address,
                        keyPairId: result.signKeyId,
                        native: quantumNative(result.publicKey),
                    },
                },
            }),
            seedKeyId: result.seedKey.id,
            isNewSeed: true,
        }
    } catch (error) {
        await kmsCore.discardMintedSeed(result.seedKey.id).catch(() => {})
        throw error
    }
}

/**
 * Which of the two quantum derivations to mint. A probe failure returns both
 * candidates unfiltered: an extra empty account is harmless, but silently
 * dropping a funded legacy address is not. `candidates` is canonical-first,
 * so "neither exists" and "probe failed" both preserve that order.
 */
const resolveQuantumCandidatesToImport = async (
    candidates: QuantumAddressCandidate[],
    scope: ChainScope,
): Promise<QuantumAddressCandidate[]> => {
    try {
        const network = algorandNetworkOf(scope)
        const existence = await Promise.all(
            candidates.map(candidate =>
                algorandAccountExists(candidate.address, network),
            ),
        )
        const existing = candidates.filter((_, index) => existence[index])
        return existing.length > 0 ? existing : [candidates[0]]
    } catch {
        return candidates
    }
}

// A quantum mnemonic is 25 words, indistinguishable from algo25 by count, so
// the caller must pick quantum explicitly. Re-importing on a fresh device could
// land on either derivation's address depending on which tool minted the
// account, so both are probed on chain and whatever exists is adopted.
const importQuantum = async (
    mnemonicIndices: Uint16Array,
    isHeld: (address: string) => boolean,
    scope: ChainScope,
    save: Save,
): Promise<WalletAccount[]> => {
    const entropy = indicesToAlgo25Seed(mnemonicIndices)
    let candidates: QuantumAddressCandidate[]
    try {
        candidates = quantumAddressCandidates(
            entropy,
            algorandQuantumDerivation,
        )
    } finally {
        zeroBytes(entropy)
    }

    const toImport = await resolveQuantumCandidatesToImport(candidates, scope)

    // Held candidates are dropped BEFORE minting, so a held legacy address can
    // never trigger the post-mint duplicate sweep against a seed record the
    // just-minted canonical sibling depends on.
    const newCandidates = toImport.filter(
        candidate => !isHeld(candidate.address),
    )
    if (newCandidates.length === 0) {
        throw new DuplicateAccountError(toImport[0].address)
    }

    const imported: WalletAccount[] = []
    // The second derivation attaches to the SAME seed record as a second
    // child, so the entropy is never persisted twice.
    let seedKeyId: string | undefined
    for (const candidate of newCandidates) {
        const result = await kmsCore.createQuantumKey({
            chain: algorandQuantumDerivation,
            mnemonicIndices,
            derivation: candidate.derivation,
            reuseSeedId: seedKeyId,
        })
        const minted: MintedAccount = {
            account: buildAccount({
                custody: { kind: 'local', seed: 'quantum' },
                chainId: ALGORAND_CHAIN_ID,
                chains: {
                    [ALGORAND_CHAIN_ID]: {
                        address: result.address,
                        keyPairId:
                            candidate.derivation === PQ_DERIVATION_CANONICAL
                                ? quantumSignKeyId(
                                      result.seedKey.id,
                                      PQ_DERIVATION_CANONICAL,
                                  )
                                : result.signKeyId,
                        native: quantumNative(result.publicKey),
                    },
                },
            }),
            seedKeyId: result.seedKey.id,
            isNewSeed: seedKeyId === undefined,
        }
        seedKeyId = minted.seedKeyId
        await save(minted)
        imported.push(minted.account)
    }
    return imported
}

const importAlgo25 = async (
    mnemonicIndices: Uint16Array,
    scope: ChainScope,
    save: Save,
): Promise<WalletAccount> => {
    const { seedKey, publicKey } = await kmsCore.createAlgo25Key({
        mnemonicIndices,
    })
    const minted: MintedAccount = {
        account: buildAccount({
            custody: { kind: 'local', seed: null },
            chainId: ALGORAND_CHAIN_ID,
            chains: {
                [ALGORAND_CHAIN_ID]: {
                    address: ed25519Address(publicKey, scope),
                    keyPairId: algo25SignKeyId(seedKey.id),
                },
            },
        }),
        seedKeyId: seedKey.id,
        isNewSeed: true,
    }
    await save(minted)
    return minted.account
}

// Each step re-derives the entropy from the indices and zeroes it before its
// probe, so no seed is held across a network round trip. The algo25 address is
// probed first so a standard account with history never pays for two Falcon
// keygens. Any failure, Falcon unavailable included, reads as "nothing found".
const withAlgo25Entropy = <T>(
    mnemonicIndices: Uint16Array,
    derive: (entropy: Uint8Array) => T,
): T => {
    const entropy = indicesToAlgo25Seed(mnemonicIndices)
    try {
        return derive(entropy)
    } finally {
        zeroBytes(entropy)
    }
}

/**
 * A quantum passphrase has as many words as a standalone one, so a standard
 * import can't tell them apart. Returns the on-chain quantum account the
 * standalone words also control when the standalone address itself has no
 * on-chain footprint.
 */
const findAlternateImportKinds = async (
    seed: LocalKeySeed,
    mnemonicIndices: Uint16Array,
    scope: ChainScope,
): Promise<readonly AlternateImportKind[]> => {
    if (seed !== null) return []
    const network = algorandNetworkOf(scope)
    try {
        const algo25Address = withAlgo25Entropy(mnemonicIndices, entropy =>
            ed25519Address(algo25PublicKeyFromSeed(entropy), scope),
        )
        if (await algorandAccountExists(algo25Address, network)) return []

        const candidates = withAlgo25Entropy(mnemonicIndices, entropy =>
            quantumAddressCandidates(entropy, algorandQuantumDerivation),
        )
        const existence = await Promise.all(
            candidates.map(candidate =>
                algorandAccountExists(candidate.address, network),
            ),
        )
        const found = candidates.find((_, index) => existence[index])
        return found
            ? [{ seed: SeedScheme.Quantum, address: found.address }]
            : []
    } catch {
        return []
    }
}

// HD accounts mint from a wallet's seed (`deriveHdAccount`), never here.
const assertSingleKey = (seed: LocalKeySeed): void => {
    if (seed === SeedScheme.Bip39) {
        throw new AccountError('A bip39 seed mints HD accounts')
    }
}

export const algorandSingleKeyAccounts: SingleKeyAccountOps = {
    create: async ({ seed, id }, scope) => {
        assertSingleKey(seed)
        return seed === SeedScheme.Quantum
            ? createQuantum(id)
            : createAlgo25(scope, id)
    },
    importMnemonic: async ({ seed, mnemonicIndices, isHeld }, scope, save) => {
        assertSingleKey(seed)
        return seed === SeedScheme.Quantum
            ? importQuantum(mnemonicIndices, isHeld, scope, save)
            : importAlgo25(mnemonicIndices, scope, save)
    },
    findAlternateImportKinds,
}
