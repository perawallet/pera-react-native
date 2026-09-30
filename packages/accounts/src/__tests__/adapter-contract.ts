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
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { setupServer } from 'msw/node'
import type { RequestHandler } from 'msw'
import type { Decimal } from 'decimal.js'
import type {
    AddressCodec,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    requireQuantum,
    requireRekey,
    requireSingleKeyAccounts,
    type AccountKeystore,
    type AccountsChainAdapter,
    type MintedAccount,
    type SingleKeyAccountKind,
} from '../chain-adapter'
import {
    DerivationTypes,
    type HDWalletDetails,
    type WalletAccount,
} from '../models'

type ChainState = {
    address: string
    /** Installed before the call, so the adapter reads this state. */
    handlers: readonly RequestHandler[]
}

export interface AccountsContractFixtures {
    scope: ChainScope
    /** The chain's own codec: every address the adapter derives must pass it. */
    codec: AddressCodec
    /** An account holding the native asset and one other asset. */
    funded: ChainState & {
        nativeAssetId: string
        /** Display units. */
        nativeBalance: Decimal
        heldAssetId: string
    }
    /** An address with no on-chain footprint at all. */
    empty: ChainState
    /** The activity probe reporting `active` as active and `inactive` as not. */
    activity: {
        active: string
        inactive: string
        handlers: readonly RequestHandler[]
    }
    /** Handlers under which every activity probe fails. */
    activityFailure: readonly RequestHandler[]
    rootKey: Uint8Array
    hdPath: {
        details: HDWalletDetails
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
        /** `account` is rekeyed to `auth`, which is itself rekeyed on to `next`; `auth` and `next` hold their keys. */
        accounts: {
            account: WalletAccount
            auth: WalletAccount
            next: WalletAccount
        }
    }
}

// Mints distinct 32-byte keys; the address comes from the adapter's own quantum
// derivation so it stays valid for the chain under test.
const createFakeKeystore = () => {
    let minted = 0
    const keystore = {
        getKey: vi.fn(() => undefined),
        createAlgo25Key: vi.fn(async (params?: { id?: string }) => {
            const n = ++minted
            return {
                seedKey: { id: params?.id ?? `seed-${n}` },
                publicKey: new Uint8Array(32).fill(n),
            }
        }),
        createQuantumKey: vi.fn(
            async (params: {
                id?: string
                reuseSeedId?: string
                chain: { addressFromPublicKey(publicKey: Uint8Array): string }
            }) => {
                const n = ++minted
                return {
                    seedKey: {
                        id: params.reuseSeedId ?? params.id ?? `seed-${n}`,
                    },
                    address: params.chain.addressFromPublicKey(
                        new Uint8Array(32).fill(n),
                    ),
                    signKeyId: `seed-${n}-sign`,
                }
            },
        ),
        removeKeyAndChildren: vi.fn(async () => {}),
    }
    return {
        keystore,
        port: keystore as unknown as AccountKeystore,
        mintCount: () =>
            keystore.createAlgo25Key.mock.calls.length +
            keystore.createQuantumKey.mock.calls.length,
    }
}

const SINGLE_KEY_KINDS: SingleKeyAccountKind[] = ['algo25', 'quantum']

/** Every chain package runs this against its own accounts adapter. */
export const accountsContractTests = (
    makeAdapter: () => AccountsChainAdapter,
    fixtures: AccountsContractFixtures,
): void => {
    const { scope, codec } = fixtures
    const server = setupServer()

    describe(`AccountsChainAdapter contract: ${makeAdapter().chainId}`, () => {
        beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
        afterEach(() => server.resetHandlers())
        afterAll(() => server.close())

        it('reads account state with the native asset among the holdings', async () => {
            server.use(...fixtures.funded.handlers)

            const state = await makeAdapter().fetchAccountState(
                fixtures.funded.address,
                scope,
                { priorResourceCount: 0 },
            )

            expect(state.nativeBalance.toString()).toBe(
                fixtures.funded.nativeBalance.toString(),
            )
            const heldIds = state.holdings.map(h => h.assetId)
            expect(heldIds).toContain(fixtures.funded.nativeAssetId)
            expect(heldIds).toContain(fixtures.funded.heldAssetId)
            if (state.authAddress !== null) {
                expect(codec.isValid(state.authAddress)).toBe(true)
            }
        })

        it('tells a funded account from an address with no footprint', async () => {
            server.use(...fixtures.funded.handlers, ...fixtures.empty.handlers)
            const adapter = makeAdapter()

            await expect(
                adapter.accountExists(fixtures.funded.address, scope),
            ).resolves.toBe(true)
            await expect(
                adapter.accountExists(fixtures.empty.address, scope),
            ).resolves.toBe(false)
        })

        it('answers activity per address', async () => {
            server.use(...fixtures.activity.handlers)
            const { active, inactive } = fixtures.activity

            const activity = await makeAdapter().checkActivity(
                [active, inactive],
                scope,
            )

            expect(activity.get(active)).toBe(true)
            expect(activity.get(inactive)).toBe(false)
        })

        it('reads a failed activity probe as inactive instead of rejecting', async () => {
            server.use(...fixtures.activityFailure)
            const { active, inactive } = fixtures.activity

            const activity = await makeAdapter().checkActivity(
                [active, inactive],
                scope,
            )

            expect(activity.get(active) ?? false).toBe(false)
            expect(activity.get(inactive) ?? false).toBe(false)
        })

        it('derives public keys per coordinate that its codec encodes as valid addresses', async () => {
            const adapter = makeAdapter()
            const getPublicKey = adapter.createPublicKeyGetter(fixtures.rootKey)
            const at = (account: number, keyIndex: number) =>
                getPublicKey({
                    account,
                    keyIndex,
                    derivationType: adapter.hdDerivationType,
                })

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

        it('names the HD child key id deterministically per coordinate and derivation type', () => {
            const adapter = makeAdapter()
            const { details } = fixtures.hdPath
            const idOf = (overrides: Partial<HDWalletDetails> = {}) =>
                adapter.hdKeyPairId('seed-1', { ...details, ...overrides })

            expect(idOf()).toBe(idOf())
            expect(idOf({ account: details.account + 1 })).not.toBe(idOf())
            expect(idOf({ keyIndex: details.keyIndex + 1 })).not.toBe(idOf())
            expect(
                idOf({
                    derivationType:
                        details.derivationType === DerivationTypes.Peikert
                            ? DerivationTypes.Khovratovich
                            : DerivationTypes.Peikert,
                }),
            ).not.toBe(idOf())
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

            expect(adapter.resolveSigner(signing, accounts)).toEqual({
                kind: 'ok',
                signer: signing,
            })
            expect(adapter.getAuthAccount(signing, accounts)).toBe(signing)
            expect(adapter.resolveSigner(watch, accounts)).toEqual({
                kind: 'watch',
                account: watch,
            })
        })

        it('follows a delegation exactly one hop, or has none to follow', () => {
            const adapter = makeAdapter()
            if (!adapter.fetchRekeyedAddresses) return

            expect(fixtures.rekeyed).toBeDefined()
            const { account, auth, next } = fixtures.rekeyed!.accounts

            expect(
                adapter.resolveSigner(account, [account, auth, next]),
            ).toEqual({
                kind: 'ok',
                signer: auth,
            })
            expect(adapter.getAuthAccount(account, [account, auth, next])).toBe(
                auth,
            )
            expect(adapter.resolveSigner(account, [account])).toMatchObject({
                kind: 'authMissing',
                authAddress: auth.address,
            })
            expect(adapter.getAuthAccount(account, [account])).toBeNull()
        })

        it('moves signing authority between accounts, or has none to move', () => {
            const adapter = makeAdapter()
            const { authority } = adapter
            if (!authority) return

            expect(fixtures.rekeyed).toBeDefined()
            const { account, auth, next } = fixtures.rekeyed!.accounts
            const { signing } = fixtures.signers
            const held = [account, auth, next, signing]
            const options = { isQuantumTargetEnabled: false }

            expect(authority.isDelegated(account)).toBe(true)
            expect(authority.isDelegated(signing)).toBe(false)
            expect(authority.accountsDelegatedTo(auth.address, held)).toEqual([
                account,
            ])
            expect(
                authority.isEligibleTarget(
                    'standard',
                    signing,
                    account,
                    held,
                    options,
                ),
            ).toBe(true)
            // Its current authority, and itself, are no-op rekeys.
            expect(
                authority.isEligibleTarget(
                    'standard',
                    auth,
                    account,
                    held,
                    options,
                ),
            ).toBe(false)
            expect(
                authority.isEligibleTarget(
                    'standard',
                    account,
                    account,
                    held,
                    options,
                ),
            ).toBe(false)
            expect(authority.canSignProgram(signing)).toBe(true)
            expect(authority.canSignProgram(account)).toBe(false)
        })

        it('derives a quantum keygen seed without touching the entropy, or refuses', () => {
            const adapter = makeAdapter()
            if (!adapter.quantum) {
                expect(() => requireQuantum(adapter)).toThrow(
                    expect.objectContaining({ chainId: adapter.chainId }),
                )
                return
            }

            const entropy = new Uint8Array(32).fill(5)
            const seed = requireQuantum(adapter).deriveKeygenSeed(entropy)

            expect(entropy).toEqual(new Uint8Array(32).fill(5))
            expect(seed.length).toBeGreaterThan(0)
            expect(seed).not.toBe(entropy)
        })

        for (const kind of SINGLE_KEY_KINDS) {
            it(`creates an unsaved ${kind} account on a new seed, or refuses`, async () => {
                const adapter = makeAdapter()
                if (!adapter.singleKeyAccounts) {
                    expect(() => requireSingleKeyAccounts(adapter)).toThrow(
                        expect.objectContaining({ chainId: adapter.chainId }),
                    )
                    return
                }
                const { port } = createFakeKeystore()

                const minted = await adapter.singleKeyAccounts.create(
                    port,
                    { kind },
                    scope,
                )

                expect(minted.account.type).toBe(kind)
                expect(
                    codec.isValid(minted.account.address, scope.networkId),
                ).toBe(true)
                expect(minted.isNewSeed).toBe(true)
            })

            it(`imports a ${kind} mnemonic, awaiting save on each account before resolving, or refuses`, async () => {
                const adapter = makeAdapter()
                if (!adapter.singleKeyAccounts) {
                    expect(() => requireSingleKeyAccounts(adapter)).toThrow(
                        expect.objectContaining({ chainId: adapter.chainId }),
                    )
                    return
                }
                expect(fixtures.singleKey).toBeDefined()
                const { mnemonicIndices, handlers } = fixtures.singleKey!
                server.use(...handlers)
                const { keystore, port } = createFakeKeystore()
                const saved: MintedAccount[] = []
                const save = async (minted: MintedAccount) => {
                    await Promise.resolve()
                    saved.push(minted)
                }

                const result = await adapter.singleKeyAccounts.importMnemonic(
                    port,
                    { kind, mnemonicIndices, isHeld: () => false },
                    scope,
                    save,
                )

                const accounts = Array.isArray(result) ? result : [result]
                expect(accounts.length).toBeGreaterThan(0)
                expect(accounts).toEqual(saved.map(minted => minted.account))
                for (const account of accounts) {
                    expect(account.type).toBe(kind)
                    expect(
                        codec.isValid(account.address, scope.networkId),
                    ).toBe(true)
                }
                // The stale-keystore-snapshot regression: import must not look keys up.
                expect(keystore.getKey).not.toHaveBeenCalled()
            })

            it(`stops minting ${kind} accounts once save rejects, or refuses`, async () => {
                const adapter = makeAdapter()
                if (!adapter.singleKeyAccounts) {
                    expect(() => requireSingleKeyAccounts(adapter)).toThrow(
                        expect.objectContaining({ chainId: adapter.chainId }),
                    )
                    return
                }
                const { mnemonicIndices, handlers } = fixtures.singleKey!
                server.use(...handlers)
                const { port, mintCount } = createFakeKeystore()

                await expect(
                    adapter.singleKeyAccounts.importMnemonic(
                        port,
                        { kind, mnemonicIndices, isHeld: () => false },
                        scope,
                        async () => {
                            throw new Error('save failed')
                        },
                    ),
                ).rejects.toThrow('save failed')

                expect(mintCount()).toBe(1)
            })
        }
    })
}
