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
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { setupServer } from 'msw/node'
import type { RequestHandler } from 'msw'
import { kmsCore } from '@perawallet/wallet-core-kms'
import {
    accountsChainAdapters,
    requireRekey,
    requireSingleKeyAccounts,
    type AccountsChainAdapter,
    type MintedAccount,
} from '../chain-adapter'
import { addressOn } from '../credentials/accessors'
import { detectImportKind, localKeyKindOf } from '../import-formats'
import type { HdIndex, WalletAccount } from '../models'
import {
    accountStateCases,
    type AccountStateContractFixtures,
} from './account-state-contract'

export interface AccountsContractFixtures extends AccountStateContractFixtures {
    rootKey: Uint8Array
    hdPath: {
        details: HdIndex
        matching: string
        mismatched: string
        malformed: string
    }
    /** Required when the adapter implements single-key accounts. */
    singleKey?: {
        mnemonicIndices: Uint16Array
        /** Handlers under which every candidate the import probes exists on chain. */
        handlers: readonly RequestHandler[]
    }
    /** Accounts on this chain: one that holds its own key, one that only watches. */
    signers: { signing: WalletAccount; watch: WalletAccount }
    /** Required when the adapter implements rekey. */
    rekeyed?: {
        authAddress: string
        rekeyedAddresses: readonly string[]
        handlers: readonly RequestHandler[]
        /**
         * Records `authAddress` as `address`'s authority on the fixtures'
         * scope. The chain package supplies it because the contract's module
         * graph holds its own copy of the accounts store.
         */
        seedAuthority(address: string, authAddress: string): void
        /** The contract seeds the relation: `account` is rekeyed to `auth`, which is itself rekeyed on to `next`. `auth` and `next` hold their keys. */
        accounts: {
            account: WalletAccount
            auth: WalletAccount
            next: WalletAccount
        }
        /** A target kind `signers.signing` is eligible under; defaults to the first of `authority.targetKinds`. */
        targetKind?: string
    }
}

const isNonEmptyString = (value: unknown): boolean =>
    typeof value === 'string' && value.length > 0

const mnemonicOf = (wordCount: number): string =>
    Array.from({ length: wordCount }, () => 'word').join(' ')

// Mints distinct keys through the kms the adapter calls, so no keystore is
// reached; a quantum address comes from the adapter's own derivation.
const stubKmsCore = () => {
    let minted = 0
    type SeedKey = Awaited<
        ReturnType<typeof kmsCore.createAlgo25Key>
    >['seedKey']
    const seedKey = (id: string) => ({ id }) as SeedKey
    const spies = [
        vi.spyOn(kmsCore, 'getKey').mockReturnValue(null),
        vi
            .spyOn(kmsCore, 'createAlgo25Key')
            .mockImplementation(async params => {
                const n = ++minted
                const id = params?.id ?? `seed-${n}`
                return {
                    seedKey: seedKey(id),
                    publicKey: new Uint8Array(32).fill(n),
                    signKeyId: `${id}-sign`,
                }
            }),
        vi
            .spyOn(kmsCore, 'createQuantumKey')
            .mockImplementation(async params => {
                const n = ++minted
                const id = params.reuseSeedId ?? params.id ?? `seed-${n}`
                return {
                    seedKey: seedKey(id),
                    address: params.chain.addressFromPublicKey(
                        new Uint8Array(32).fill(n),
                    ),
                    signKeyId: `${id}-sign-${n}`,
                    publicKey: new Uint8Array(32).fill(n),
                }
            }),
        vi.spyOn(kmsCore, 'discardMintedSeed').mockResolvedValue(),
    ] as const
    return {
        getKey: spies[0],
        mintCount: () => minted,
        restore: () => spies.forEach(spy => spy.mockRestore()),
    }
}

/** Every chain package runs this against its own accounts adapter. */
export const accountsContractTests = (
    makeAdapter: () => AccountsChainAdapter,
    fixtures: AccountsContractFixtures,
): void => {
    const { scope, codec } = fixtures
    const server = setupServer()
    const singleKeyKinds = makeAdapter().localKeyKinds.filter(
        kind => !kind.isHd,
    )

    describe(`AccountsChainAdapter contract: ${makeAdapter().chainId}`, () => {
        let kms: ReturnType<typeof stubKmsCore>

        beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
        beforeEach(() => {
            kms = stubKmsCore()
            // The import-format helpers read the registry; a chain package
            // registers its adapter in its own, so the suite registers it here.
            const adapter = makeAdapter()
            if (!accountsChainAdapters.has(adapter.chainId)) {
                accountsChainAdapters.register(adapter)
            }
        })
        afterEach(() => {
            kms.restore()
            server.resetHandlers()
        })
        afterAll(() => server.close())

        accountStateCases(makeAdapter, fixtures, server)

        it('derives public keys per coordinate that its codec encodes as valid addresses', async () => {
            const adapter = makeAdapter()
            const getPublicKey = adapter.createPublicKeyGetter(fixtures.rootKey)
            const at = (account: number, keyIndex: number) =>
                getPublicKey({ account, keyIndex })

            const [first, again, other] = await Promise.all([
                at(0, 0),
                at(0, 0),
                at(0, 1),
            ])

            expect(Array.from(again)).toEqual(Array.from(first))
            expect(Array.from(other)).not.toEqual(Array.from(first))
            const address = codec.fromPublicKey(first, {
                scheme: 'ed25519',
                networkId: scope.networkId,
            })
            expect(codec.isValid(address, scope.networkId)).toBe(true)
        })

        it('names the HD child key id deterministically per coordinate', () => {
            const adapter = makeAdapter()
            const { details } = fixtures.hdPath
            const idOf = (overrides: Partial<HdIndex> = {}) =>
                adapter.hdKeyPairId('seed-1', {
                    account: details.account,
                    keyIndex: details.keyIndex,
                    ...overrides,
                })

            expect(idOf()).toBe(idOf())
            expect(idOf({ account: details.account + 1 })).not.toBe(idOf())
            expect(idOf({ keyIndex: details.keyIndex + 1 })).not.toBe(idOf())
        })

        it('accepts the matching HD path and rejects the others with their reason', () => {
            const adapter = makeAdapter()
            const { details, matching, mismatched, malformed } = fixtures.hdPath

            expect(() =>
                adapter.assertHdPathMatches(matching, details),
            ).not.toThrow()
            expect(() =>
                adapter.assertHdPathMatches(mismatched, details),
            ).toThrow(expect.objectContaining({ reason: 'mismatch' }))
            expect(() =>
                adapter.assertHdPathMatches(malformed, details),
            ).toThrow(expect.objectContaining({ reason: 'malformed' }))
        })

        it('declares its local key kinds: at least one, at most one HD, each with a word count', () => {
            const { localKeyKinds } = makeAdapter()

            expect(localKeyKinds.length).toBeGreaterThan(0)
            expect(
                localKeyKinds.filter(kind => kind.isHd).length,
            ).toBeLessThanOrEqual(1)
            for (const kind of localKeyKinds) {
                expect(kind.mnemonicWordCounts.length).toBeGreaterThan(0)
            }
            const seeds = localKeyKinds.map(kind => kind.seed)
            expect(new Set(seeds).size).toBe(seeds.length)
        })

        it('detects only auto-detected kinds from a word count, and fails on a count none takes', () => {
            const adapter = makeAdapter()
            const counts = adapter.localKeyKinds.flatMap(
                kind => kind.mnemonicWordCounts,
            )

            for (const wordCount of counts) {
                const detected = detectImportKind(
                    adapter.chainId,
                    mnemonicOf(wordCount),
                )
                const expected = adapter.localKeyKinds.find(
                    kind =>
                        kind.isAutoDetected &&
                        kind.mnemonicWordCounts.includes(wordCount),
                )
                expect(detected).toEqual(
                    expected
                        ? { success: true, seed: expected.seed }
                        : { success: false, wordCount },
                )
                if (detected.success) {
                    expect(
                        localKeyKindOf(adapter.chainId, detected.seed)
                            ?.isAutoDetected,
                    ).toBe(true)
                }
            }
            const unknown = Math.max(...counts) + 1
            expect(
                detectImportKind(adapter.chainId, mnemonicOf(unknown)),
            ).toEqual({ success: false, wordCount: unknown })
        })

        it('ranks duplicates deterministically, a key holder above a watch account', () => {
            const adapter = makeAdapter()
            const { signing, watch } = fixtures.signers

            const rank = adapter.duplicateRank(signing)

            expect(Number.isFinite(rank)).toBe(true)
            expect(adapter.duplicateRank(signing)).toBe(rank)
            expect(rank).toBeGreaterThan(adapter.duplicateRank(watch))
        })

        it('describes each account kind with non-empty copy keys and glyph', () => {
            const { presentation } = makeAdapter()
            const { signing, watch } = fixtures.signers
            const accounts = [signing, watch]

            const described = accounts.map(account =>
                presentation.describe(account, accounts, fixtures.scope),
            )

            for (const kind of described) {
                for (const key of [
                    kind.kindId,
                    kind.labelKey,
                    kind.infoTitleKey,
                    kind.infoBodyKey,
                    kind.glyph,
                    kind.analyticsKind,
                ]) {
                    expect(isNonEmptyString(key)).toBe(true)
                }
            }
            expect(described[0].kindId).not.toBe(described[1].kindId)
            for (const kind of described) {
                expect(presentation.kindGlyph(kind.kindId)).toBe(kind.glyph)
            }
            expect(presentation.kindGlyph('not-a-kind')).toBeUndefined()
            const label = presentation.transitionLabel(watch, signing)
            expect(isNonEmptyString(label.labelKey)).toBe(true)
            expect(isNonEmptyString(label.signerKey)).toBe(true)
            expect(isNonEmptyString(label.descriptionKey)).toBe(true)
        })

        it('names a device account type for each account, or registers none', () => {
            const adapter = makeAdapter()
            if (!adapter.deviceAccountType) return

            for (const account of Object.values(fixtures.signers)) {
                const type = adapter.deviceAccountType(account)
                expect(type === null || isNonEmptyString(type)).toBe(true)
            }
        })

        it('decodes nothing from a value that is not its legacy record, without throwing', () => {
            const adapter = makeAdapter()
            const malformed: unknown[] = [
                null,
                undefined,
                42,
                'record',
                true,
                [],
                {},
                { address: 42, chains: 'x', custody: 7 },
                { chains: null, custody: null },
            ]

            for (const raw of malformed.slice(0, 5)) {
                expect(adapter.decodeLegacyRecord(raw)).toBeUndefined()
            }
            for (const raw of malformed) {
                expect(() => adapter.decodeLegacyRecord(raw)).not.toThrow()
            }
        })

        it('finds the accounts rekeyed to an address, or refuses on a chain without rekey', async () => {
            const adapter = makeAdapter()
            if (!adapter.fetchRekeyedAddresses) {
                expect(() => requireRekey(adapter)).toThrow(
                    expect.objectContaining({ chainId: adapter.chainId }),
                )
                return
            }

            expect(fixtures.rekeyed).toBeDefined()
            const { authAddress, rekeyedAddresses, handlers } =
                fixtures.rekeyed!
            server.use(...handlers)

            const found = await requireRekey(adapter)(authAddress, scope)

            expect([...found].sort()).toEqual([...rekeyedAddresses].sort())
        })

        it('resolves a key-holding account to itself and a watch account to no signer', () => {
            const adapter = makeAdapter()
            const { signing, watch } = fixtures.signers
            const accounts = [signing, watch]

            expect(adapter.resolveSigner(signing, accounts, scope)).toEqual({
                kind: 'ok',
                signer: signing,
            })
            expect(adapter.getAuthAccount(signing, accounts, scope)).toBe(
                signing,
            )
            expect(adapter.resolveSigner(watch, accounts, scope)).toEqual({
                kind: 'watch',
                account: watch,
            })
        })

        it('follows a delegation exactly one hop, or has none to follow', () => {
            const adapter = makeAdapter()
            if (!adapter.fetchRekeyedAddresses) return

            expect(fixtures.rekeyed).toBeDefined()
            const { account, auth, next } = fixtures.rekeyed!.accounts
            const { seedAuthority } = fixtures.rekeyed!
            seedAuthority(addressOn(account, scope)!, addressOn(auth, scope)!)
            seedAuthority(addressOn(auth, scope)!, addressOn(next, scope)!)

            expect(
                adapter.resolveSigner(account, [account, auth, next], scope),
            ).toEqual({
                kind: 'ok',
                signer: auth,
            })
            expect(
                adapter.getAuthAccount(account, [account, auth, next], scope),
            ).toBe(auth)
            expect(
                adapter.resolveSigner(account, [account], scope),
            ).toMatchObject({
                kind: 'authMissing',
                authorityAddress: addressOn(auth, scope),
            })
            expect(adapter.getAuthAccount(account, [account], scope)).toBeNull()
        })

        it('moves signing authority between accounts, or has none to move', () => {
            const adapter = makeAdapter()
            const { authority } = adapter
            if (!authority) return

            expect(fixtures.rekeyed).toBeDefined()
            const { account, auth, next } = fixtures.rekeyed!.accounts
            const { signing } = fixtures.signers
            const held = [account, auth, next, signing]
            const kind =
                fixtures.rekeyed!.targetKind ?? authority.targetKinds[0]
            const { seedAuthority } = fixtures.rekeyed!
            seedAuthority(addressOn(account, scope)!, addressOn(auth, scope)!)
            seedAuthority(addressOn(auth, scope)!, addressOn(next, scope)!)

            expect(authority.targetKinds.length).toBeGreaterThan(0)
            expect(authority.targetKinds).toContain(kind)
            expect(authority.isDelegated(account, scope)).toBe(true)
            expect(authority.isDelegated(signing, scope)).toBe(false)
            expect(
                authority.accountsDelegatedTo(addressOn(auth, scope)!, held),
            ).toEqual([account])
            expect(
                authority.isEligibleTarget(
                    kind,
                    signing,
                    account,
                    held,
                    scope,
                    {},
                ),
            ).toBe(true)
            // Its current authority, and itself, are no-op rekeys.
            expect(
                authority.isEligibleTarget(
                    kind,
                    auth,
                    account,
                    held,
                    scope,
                    {},
                ),
            ).toBe(false)
            expect(
                authority.isEligibleTarget(
                    kind,
                    account,
                    account,
                    held,
                    scope,
                    {},
                ),
            ).toBe(false)
            expect(
                authority.isEligibleTarget(
                    'not-a-target-kind',
                    signing,
                    account,
                    held,
                    scope,
                    {},
                ),
            ).toBe(false)
            expect(
                typeof authority.isAuthorityDowngrade(
                    account,
                    signing,
                    held,
                    scope,
                ),
            ).toBe('boolean')
            expect(authority.canSignProgram(signing, scope)).toBe(true)
            expect(authority.canSignProgram(account, scope)).toBe(false)
        })

        it('refuses single-key accounts when it declares no single-key kind', () => {
            const adapter = makeAdapter()
            if (adapter.singleKeyAccounts) {
                expect(singleKeyKinds.length).toBeGreaterThan(0)
                return
            }
            expect(() => requireSingleKeyAccounts(adapter)).toThrow(
                expect.objectContaining({ chainId: adapter.chainId }),
            )
        })

        it('finds the accounts the same words control as another kind, or none', async () => {
            const adapter = makeAdapter()
            if (!adapter.singleKeyAccounts || !fixtures.singleKey) return
            const { mnemonicIndices, handlers } = fixtures.singleKey
            server.use(...handlers)

            for (const kind of singleKeyKinds) {
                const found =
                    await adapter.singleKeyAccounts.findAlternateImportKinds(
                        kind.seed,
                        mnemonicIndices,
                        scope,
                    )

                expect(Array.isArray(found)).toBe(true)
                for (const alternate of found) {
                    expect(alternate.seed).not.toBe(kind.seed)
                    expect(
                        codec.isValid(alternate.address, scope.networkId),
                    ).toBe(true)
                }
            }
        })

        for (const kind of singleKeyKinds) {
            it(`creates an unsaved ${kind.seed} account on a new seed`, async () => {
                const adapter = makeAdapter()
                const ops = requireSingleKeyAccounts(adapter)

                const minted = await ops.create({ seed: kind.seed }, scope)

                expect(minted.account.custody).toMatchObject({
                    kind: 'local',
                    seed: kind.seed,
                })
                expect(
                    codec.isValid(
                        addressOn(minted.account, scope) ?? '',
                        scope.networkId,
                    ),
                ).toBe(true)
                expect(minted.isNewSeed).toBe(true)
            })

            it(`imports a ${kind.seed} mnemonic, awaiting save on each account before resolving`, async () => {
                const adapter = makeAdapter()
                const ops = requireSingleKeyAccounts(adapter)
                expect(fixtures.singleKey).toBeDefined()
                const { mnemonicIndices, handlers } = fixtures.singleKey!
                server.use(...handlers)
                const saved: MintedAccount[] = []
                const save = async (minted: MintedAccount) => {
                    await Promise.resolve()
                    saved.push(minted)
                }

                const result = await ops.importMnemonic(
                    { seed: kind.seed, mnemonicIndices, isHeld: () => false },
                    scope,
                    save,
                )

                const accounts = Array.isArray(result) ? result : [result]
                expect(accounts.length).toBeGreaterThan(0)
                expect(accounts).toEqual(saved.map(minted => minted.account))
                for (const account of accounts) {
                    expect(account.custody).toMatchObject({
                        kind: 'local',
                        seed: kind.seed,
                    })
                    expect(
                        codec.isValid(
                            addressOn(account, scope) ?? '',
                            scope.networkId,
                        ),
                    ).toBe(true)
                }
                // The stale-keystore-snapshot regression: import must not look keys up.
                expect(kms.getKey).not.toHaveBeenCalled()
            })

            it(`stops minting ${kind.seed} accounts once save rejects`, async () => {
                const adapter = makeAdapter()
                const ops = requireSingleKeyAccounts(adapter)
                const { mnemonicIndices, handlers } = fixtures.singleKey!
                server.use(...handlers)

                await expect(
                    ops.importMnemonic(
                        {
                            seed: kind.seed,
                            mnemonicIndices,
                            isHeld: () => false,
                        },
                        scope,
                        async () => {
                            throw new Error('save failed')
                        },
                    ),
                ).rejects.toThrow('save failed')

                expect(kms.mintCount()).toBe(1)
            })
        }
    })
}
