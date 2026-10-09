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

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '../../__tests__/registerAlgorandAccounts'
import {
    AccountError,
    chainAccountOf,
    DuplicateAccountError,
    type MintedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    algo25SignKeyId,
    mnemonicWordsToIndices,
    quantumAddressCandidates,
    PQ_DERIVATION_CANONICAL,
    PQ_DERIVATION_LEGACY,
    SeedScheme,
} from '@perawallet/wallet-core-kms'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandAddressCodec } from '../address-codec'
import { algorandAccountExists } from '../discovery'
import { algorandQuantumDerivation } from '../quantum'
import { algorandSingleKeyAccounts } from '../single-key-accounts'

const keystore = vi.hoisted(() => ({
    getKey: vi.fn(),
    createAlgo25Key: vi.fn(),
    createQuantumKey: vi.fn(),
    discardMintedSeed: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-kms')>()
    return {
        ...actual,
        kmsCore: keystore,
        quantumAddressCandidates: vi.fn(actual.quantumAddressCandidates),
    }
})

vi.mock('../discovery', async importOriginal => ({
    ...(await importOriginal<object>()),
    algorandAccountExists: vi.fn(),
}))

// Same pinned vector as the kms candidate specs, so the probe can be stubbed
// per derivation.
const MNEMONIC_INDICES = mnemonicWordsToIndices(
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'.split(
        ' ',
    ),
)!
const CANONICAL_ADDRESS =
    'H325AXRDHRSZU5727LVZKTKYJVRRGD2MNUXVSPUONMSPTRCXQLWIU36CLI'
const LEGACY_ADDRESS =
    'TQLMWJPC7FZQ2EE7HWCWODSGZPCCESJHQIH3VEGKKJ23YFSFCD4Y662IOU'
// The same words read as a standard (algo25) passphrase.
const ALGO25_ADDRESS =
    'T2A7FPKQ3YON2JT5A5CSN4JWNDMUGJY6WX4H6HEH2UPKWSPSPBG5O7X4UM'

const scope = scopeForLegacyNetwork('mainnet')
const ALGO25_PUBLIC_KEY = new Uint8Array(32).fill(7)
const QUANTUM_PUBLIC_KEY = new Uint8Array(1793).fill(9)
// Stored so a realm without keystore access can still describe the account.
const QUANTUM_NATIVE = {
    family: 'algorand',
    pq: {
        scheme: 'falcon-1024',
        publicKey: encodeToBase64(QUANTUM_PUBLIC_KEY),
    },
}

const seedKey = (id: string) => ({ id }) as never

const entryOf = (account: WalletAccount) =>
    chainAccountOf(account, ALGORAND_CHAIN_ID)

/** `'error'` makes the probe for that address reject. */
const mockOnChain = (existence: Record<string, boolean | 'error'>) =>
    vi.mocked(algorandAccountExists).mockImplementation(async address => {
        const exists = existence[address]
        if (exists === 'error') throw new Error('probe failed')
        return exists ?? false
    })

const importQuantum = (
    isHeld: (address: string) => boolean = () => false,
    save: (minted: MintedAccount) => Promise<void> = async () => {},
) =>
    algorandSingleKeyAccounts.importMnemonic(
        { seed: SeedScheme.Quantum, mnemonicIndices: MNEMONIC_INDICES, isHeld },
        scope,
        save,
    ) as Promise<WalletAccount[]>

describe('algorandSingleKeyAccounts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        keystore.getKey.mockReturnValue(undefined)
        keystore.createAlgo25Key.mockResolvedValue({
            seedKey: seedKey('SEED1'),
            publicKey: ALGO25_PUBLIC_KEY,
        })
        // Address and signKeyId vary by derivation, and the seed id by
        // reuseSeedId, so the dual-probe import can mint both legs.
        keystore.createQuantumKey.mockImplementation(
            async (params: { derivation?: string; reuseSeedId?: string }) => {
                const seedId = params.reuseSeedId ?? 'QSEED1'
                const isLegacy = params.derivation === PQ_DERIVATION_LEGACY
                return {
                    seedKey: seedKey(seedId),
                    address: isLegacy ? LEGACY_ADDRESS : CANONICAL_ADDRESS,
                    signKeyId: isLegacy
                        ? `${seedId}-quantum`
                        : `${seedId}-quantum-pqk1`,
                    publicKey: QUANTUM_PUBLIC_KEY,
                }
            },
        )
        keystore.discardMintedSeed.mockResolvedValue(undefined)
        mockOnChain({ [CANONICAL_ADDRESS]: false, [LEGACY_ADDRESS]: false })
    })

    describe('create', () => {
        it('mints a new algo25 seed and points the account at its ed25519 child', async () => {
            const minted = await algorandSingleKeyAccounts.create(
                { seed: null, id: 'SEED1' },
                scope,
            )

            expect(keystore.createAlgo25Key).toHaveBeenCalledWith({
                id: 'SEED1',
            })
            expect(minted.isNewSeed).toBe(true)
            expect(minted.seedKeyId).toBe('SEED1')
            const address = algorandAddressCodec.fromPublicKey(
                ALGO25_PUBLIC_KEY,
                { scheme: 'ed25519', networkId: 'mainnet' },
            )
            expect(minted.account).toEqual({
                id: expect.any(String),
                custody: { kind: 'local', seed: null },
                chains: {
                    algorand: {
                        address,
                        keyPairId: algo25SignKeyId('SEED1'),
                    },
                },
            })
        })

        it('reuses an existing algo25 root key without minting', async () => {
            keystore.getKey.mockReturnValue({
                id: 'SEED1',
                publicKey: ALGO25_PUBLIC_KEY,
            })

            const minted = await algorandSingleKeyAccounts.create(
                { seed: null, id: 'SEED1' },
                scope,
            )

            expect(keystore.createAlgo25Key).not.toHaveBeenCalled()
            expect(minted.isNewSeed).toBe(false)
            expect(entryOf(minted.account)?.keyPairId).toBe(
                algo25SignKeyId('SEED1'),
            )
        })

        it('propagates an algo25 mint failure', async () => {
            keystore.createAlgo25Key.mockRejectedValue(new Error('boom'))

            await expect(
                algorandSingleKeyAccounts.create({ seed: null }, scope),
            ).rejects.toThrow('boom')
        })

        it('mints a quantum key on the Algorand derivation and uses its sign key id', async () => {
            const minted = await algorandSingleKeyAccounts.create(
                { seed: SeedScheme.Quantum },
                scope,
            )

            expect(keystore.createQuantumKey).toHaveBeenCalledWith({
                id: undefined,
                chain: algorandQuantumDerivation,
            })
            expect(minted.isNewSeed).toBe(true)
            expect(minted.account).toEqual({
                id: expect.any(String),
                custody: { kind: 'local', seed: 'quantum' },
                chains: {
                    algorand: {
                        address: CANONICAL_ADDRESS,
                        keyPairId: 'QSEED1-quantum-pqk1',
                        native: QUANTUM_NATIVE,
                    },
                },
            })
        })

        it('refuses a bip39 seed, which mints HD accounts instead', async () => {
            await expect(
                algorandSingleKeyAccounts.create(
                    { seed: SeedScheme.Bip39 },
                    scope,
                ),
            ).rejects.toBeInstanceOf(AccountError)
            expect(keystore.createAlgo25Key).not.toHaveBeenCalled()
        })

        it('propagates a quantum mint failure', async () => {
            keystore.createQuantumKey.mockRejectedValue(new Error('boom'))

            await expect(
                algorandSingleKeyAccounts.create(
                    { seed: SeedScheme.Quantum },
                    scope,
                ),
            ).rejects.toThrow('boom')
        })
    })

    describe('importMnemonic', () => {
        it('imports algo25 from the minted public key without looking a key up', async () => {
            const indices = new Uint16Array(25)
            const save = vi.fn(async () => {})

            const account = await algorandSingleKeyAccounts.importMnemonic(
                {
                    seed: null,
                    mnemonicIndices: indices,
                    isHeld: () => false,
                },
                scope,
                save,
            )

            expect(keystore.createAlgo25Key).toHaveBeenCalledWith({
                mnemonicIndices: indices,
            })
            expect(keystore.getKey).not.toHaveBeenCalled()
            expect(account).toMatchObject({
                custody: { kind: 'local', seed: null },
                chains: {
                    algorand: {
                        address: expect.any(String),
                        keyPairId: algo25SignKeyId('SEED1'),
                    },
                },
            })
            expect(save).toHaveBeenCalledWith(
                expect.objectContaining({ seedKeyId: 'SEED1' }),
            )
        })

        it('imports only the canonical quantum account when neither address exists on chain', async () => {
            const accounts = await importQuantum()

            expect(accounts).toHaveLength(1)
            expect(accounts[0].custody).toEqual({
                kind: 'local',
                seed: 'quantum',
            })
            expect(accounts[0].chains).toEqual({
                algorand: {
                    address: CANONICAL_ADDRESS,
                    keyPairId: 'QSEED1-quantum-pqk1',
                    native: QUANTUM_NATIVE,
                },
            })
            expect(keystore.createQuantumKey).toHaveBeenCalledWith({
                chain: algorandQuantumDerivation,
                mnemonicIndices: MNEMONIC_INDICES,
                derivation: PQ_DERIVATION_CANONICAL,
                reuseSeedId: undefined,
            })
        })

        it('imports both derivations onto one seed when both exist on chain', async () => {
            mockOnChain({ [CANONICAL_ADDRESS]: true, [LEGACY_ADDRESS]: true })

            const accounts = await importQuantum()

            expect(accounts.map(a => entryOf(a)?.address)).toEqual([
                CANONICAL_ADDRESS,
                LEGACY_ADDRESS,
            ])
            const [[first], [second]] = keystore.createQuantumKey.mock.calls
            expect(first.reuseSeedId).toBeUndefined()
            expect(second.reuseSeedId).toBe('QSEED1')
        })

        it('imports only the legacy account, keyed by the minted sign key, when just it exists', async () => {
            mockOnChain({ [CANONICAL_ADDRESS]: false, [LEGACY_ADDRESS]: true })

            const accounts = await importQuantum()

            expect(accounts).toHaveLength(1)
            expect(entryOf(accounts[0])).toEqual({
                address: LEGACY_ADDRESS,
                keyPairId: 'QSEED1-quantum',
                native: QUANTUM_NATIVE,
            })
        })

        it('imports both derivations when the on-chain probe fails', async () => {
            mockOnChain({
                [CANONICAL_ADDRESS]: 'error',
                [LEGACY_ADDRESS]: 'error',
            })

            const accounts = await importQuantum()

            expect(accounts).toHaveLength(2)
        })

        it('skips a held legacy address before minting anything for it', async () => {
            mockOnChain({ [CANONICAL_ADDRESS]: true, [LEGACY_ADDRESS]: true })

            const accounts = await importQuantum(
                address => address === LEGACY_ADDRESS,
            )

            expect(accounts.map(a => entryOf(a)?.address)).toEqual([
                CANONICAL_ADDRESS,
            ])
            expect(keystore.createQuantumKey).toHaveBeenCalledTimes(1)
            expect(keystore.discardMintedSeed).not.toHaveBeenCalled()
        })

        it('rejects as a duplicate, minting nothing, when every candidate is held', async () => {
            await expect(importQuantum(() => true)).rejects.toBeInstanceOf(
                DuplicateAccountError,
            )

            expect(keystore.createQuantumKey).not.toHaveBeenCalled()
        })

        it('keeps what was saved when a later mint fails', async () => {
            mockOnChain({ [CANONICAL_ADDRESS]: true, [LEGACY_ADDRESS]: true })
            const save = vi.fn(async () => {})
            keystore.createQuantumKey
                .mockResolvedValueOnce({
                    seedKey: seedKey('QSEED1'),
                    address: CANONICAL_ADDRESS,
                    signKeyId: 'QSEED1-quantum-pqk1',
                    publicKey: QUANTUM_PUBLIC_KEY,
                })
                .mockRejectedValueOnce(new Error('boom'))

            await expect(importQuantum(() => false, save)).rejects.toThrow(
                'boom',
            )
            expect(save).toHaveBeenCalledTimes(1)
        })

        it('derives the same address on repeated imports of one mnemonic', async () => {
            const first = await importQuantum()
            const second = await importQuantum()

            expect(entryOf(second[0])?.address).toBe(entryOf(first[0])?.address)
        })
    })

    describe('findAlternateImportKinds', () => {
        const find = () =>
            algorandSingleKeyAccounts.findAlternateImportKinds(
                null,
                MNEMONIC_INDICES,
                scope,
            )
        const quantumAt = (address: string) => [
            { seed: SeedScheme.Quantum, address },
        ]

        it('offers nothing for a quantum import', async () => {
            mockOnChain({ [CANONICAL_ADDRESS]: true })

            await expect(
                algorandSingleKeyAccounts.findAlternateImportKinds(
                    SeedScheme.Quantum,
                    MNEMONIC_INDICES,
                    scope,
                ),
            ).resolves.toEqual([])
            expect(algorandAccountExists).not.toHaveBeenCalled()
        })

        it('returns nothing when the algo25 account exists', async () => {
            mockOnChain({ [ALGO25_ADDRESS]: true, [CANONICAL_ADDRESS]: true })

            await expect(find()).resolves.toEqual([])
            expect(algorandAccountExists).toHaveBeenCalledTimes(1)
            expect(algorandAccountExists).toHaveBeenCalledWith(
                ALGO25_ADDRESS,
                'mainnet',
            )
        })

        it('returns the canonical quantum address when it exists on chain', async () => {
            mockOnChain({ [CANONICAL_ADDRESS]: true, [LEGACY_ADDRESS]: true })

            await expect(find()).resolves.toEqual(quantumAt(CANONICAL_ADDRESS))
        })

        it('returns the legacy quantum address when only it exists on chain', async () => {
            mockOnChain({ [LEGACY_ADDRESS]: true })

            await expect(find()).resolves.toEqual(quantumAt(LEGACY_ADDRESS))
        })

        it('returns nothing when no account for these words exists on chain', async () => {
            await expect(find()).resolves.toEqual([])
        })

        it('returns nothing when a probe fails rather than blocking the import', async () => {
            mockOnChain({ [ALGO25_ADDRESS]: 'error' })
            await expect(find()).resolves.toEqual([])

            mockOnChain({
                [CANONICAL_ADDRESS]: 'error',
                [LEGACY_ADDRESS]: true,
            })
            await expect(find()).resolves.toEqual([])
        })

        it('returns nothing when Falcon keygen is unavailable rather than blocking the import', async () => {
            vi.mocked(quantumAddressCandidates).mockImplementationOnce(() => {
                throw new Error('falcon-1024 failed to load')
            })
            mockOnChain({ [CANONICAL_ADDRESS]: true })

            await expect(find()).resolves.toEqual([])
        })

        it('does not derive quantum keys when the algo25 account exists', async () => {
            mockOnChain({ [ALGO25_ADDRESS]: true })

            await find()

            expect(quantumAddressCandidates).not.toHaveBeenCalled()
        })
    })
})
