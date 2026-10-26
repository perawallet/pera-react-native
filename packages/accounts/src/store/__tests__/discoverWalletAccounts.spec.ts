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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import { buildTestAccount, TEST_CUSTODY } from '../../__tests__/accountFactory'
import {
    ALGORAND,
    ETHEREUM,
    familyHdAddress,
    familyHdKeyId,
    familyHdPublicKey,
    registerChainFamilies,
    deriveInMemoryOn,
    type ChainFamilies,
} from '../../__tests__/chainFamilies'
import { hdIndexOf } from '../../credentials'
import { deriveClaimedKey } from '../../key-claims'
import type { HdIndex } from '../../models'
import { useAccountsStore } from '../store'

const SEED = 'hd-seed'

const familyOf = (chainId: ChainId) =>
    chainId === ALGORAND ? 'algorand' : 'evm'

const pathHolder = (index: HdIndex, chainId: ChainId = ALGORAND) =>
    buildTestAccount(
        { kind: 'local', seed: 'bip39', hd: index },
        {
            [chainId]: {
                address: familyHdAddress(
                    familyOf(chainId),
                    index.account,
                    index.keyIndex,
                ),
                keyPairId: familyHdKeyId(
                    SEED,
                    familyOf(chainId),
                    index.account,
                    index.keyIndex,
                ),
            },
        },
        { id: `holder-${index.account}-${index.keyIndex}` },
    )

describe('discoverWalletAccounts', () => {
    let families: ChainFamilies
    const state = () => useAccountsStore.getState()
    const removed = () =>
        vi.mocked(getProvider().key.store.remove).mock.calls.map(([id]) => id)

    const activeAt = (chainId: ChainId, indexes: readonly HdIndex[]) => {
        const addresses = indexes.map(({ account, keyIndex }) =>
            familyHdAddress(familyOf(chainId), account, keyIndex),
        )
        families.checkActivity
            .get(chainId)!
            .mockImplementation(
                async (probed: string[]) =>
                    new Map(probed.map(a => [a, addresses.includes(a)])),
            )
    }

    beforeEach(() => {
        families = registerChainFamilies([ALGORAND, ETHEREUM])
        getKeystoreStore().state.keys = [
            { id: SEED, type: 'seed', metadata: { scheme: 'bip39' } },
            {
                id: familyHdKeyId(SEED, 'algorand', 0, 0),
                type: 'ed25519',
                metadata: { parentKeyId: SEED },
            },
        ] as never
        vi.mocked(getProvider().key.store.remove).mockClear()
        state().resetState()
    })

    test("adds a chain active at a held path to that path's account, as discovered", async () => {
        activeAt(ALGORAND, [{ account: 0, keyIndex: 0 }])
        activeAt(ETHEREUM, [{ account: 0, keyIndex: 0 }])
        state().setAccounts([pathHolder({ account: 0, keyIndex: 0 })])

        const changed = await state().discoverWalletAccounts(SEED)

        expect(changed.map(account => account.id)).toEqual(['holder-0-0'])
        expect(state().accounts).toHaveLength(1)
        expect(state().accounts[0].chains[ETHEREUM]).toMatchObject({
            address: familyHdAddress('evm', 0, 0),
            keyPairId: familyHdKeyId(SEED, 'evm', 0, 0),
            enabledBy: 'discovery',
        })
    })

    test('creates an account at an active index nobody holds, with only its active chains', async () => {
        activeAt(ALGORAND, [{ account: 0, keyIndex: 0 }])
        activeAt(ETHEREUM, [{ account: 2, keyIndex: 0 }])
        state().setAccounts([pathHolder({ account: 0, keyIndex: 0 })])

        await state().discoverWalletAccounts(SEED)

        const created = state().accounts.find(
            account => hdIndexOf(account)?.account === 2,
        )
        expect(created?.custody).toEqual({
            kind: 'local',
            seed: 'bip39',
            hd: { account: 2, keyIndex: 0 },
        })
        expect(Object.keys(created?.chains ?? {})).toEqual([ETHEREUM])
        expect(created?.chains[ETHEREUM]?.enabledBy).toBe('discovery')
    })

    test('leaves a declined index alone, on every chain', async () => {
        activeAt(ALGORAND, [
            { account: 0, keyIndex: 0 },
            { account: 0, keyIndex: 1 },
        ])
        activeAt(ETHEREUM, [{ account: 0, keyIndex: 1 }])
        state().setAccounts([pathHolder({ account: 0, keyIndex: 0 })])

        await state().discoverWalletAccounts(SEED, {
            declinedIndexes: [{ account: 0, keyIndex: 1 }],
        })

        expect(state().accounts.map(account => account.id)).toEqual([
            'holder-0-0',
        ])
        expect(removed()).toContain(familyHdKeyId(SEED, 'evm', 0, 1))
        expect(removed()).toContain(familyHdKeyId(SEED, 'algorand', 0, 1))
    })

    test('walks past the fiftieth account index when the wallet already holds accounts there', async () => {
        const held = Array.from({ length: 60 }, (_, account) => ({
            account,
            keyIndex: 0,
        }))
        getKeystoreStore().state.keys = [
            ...getKeystoreStore().state.keys,
            ...held.map(({ account, keyIndex }) => ({
                id: familyHdKeyId(SEED, 'algorand', account, keyIndex),
                type: 'ed25519',
                metadata: { parentKeyId: SEED },
            })),
        ] as never
        activeAt(ALGORAND, held)
        activeAt(ETHEREUM, [{ account: 55, keyIndex: 0 }])
        state().setAccounts(held.map(index => pathHolder(index)))

        await state().discoverWalletAccounts(SEED)

        expect(
            state().accounts.find(account => account.id === 'holder-55-0')
                ?.chains[ETHEREUM]?.enabledBy,
        ).toBe('discovery')
    })

    test('skips a chain whose address another account holds, and removes its key', async () => {
        activeAt(ALGORAND, [{ account: 0, keyIndex: 0 }])
        activeAt(ETHEREUM, [{ account: 0, keyIndex: 0 }])
        const watcher = buildTestAccount(
            TEST_CUSTODY.watch,
            { [ETHEREUM]: { address: familyHdAddress('evm', 0, 0) } },
            { id: 'watcher' },
        )
        state().setAccounts([pathHolder({ account: 0, keyIndex: 0 }), watcher])

        await expect(state().discoverWalletAccounts(SEED)).resolves.toEqual([])

        expect(state().accounts[0].chains[ETHEREUM]).toBeUndefined()
        expect(removed()).toContain(familyHdKeyId(SEED, 'evm', 0, 0))
    })

    test('creates nothing at an unheld index whose address another account holds, and removes the key its failed add derived', async () => {
        activeAt(ALGORAND, [{ account: 0, keyIndex: 0 }])
        activeAt(ETHEREUM, [{ account: 2, keyIndex: 0 }])
        const watcher = buildTestAccount(
            TEST_CUSTODY.watch,
            { [ETHEREUM]: { address: familyHdAddress('evm', 2, 0) } },
            { id: 'watcher' },
        )
        state().setAccounts([pathHolder({ account: 0, keyIndex: 0 }), watcher])

        await expect(state().discoverWalletAccounts(SEED)).resolves.toEqual([])

        expect(
            state().accounts.some(account => hdIndexOf(account)?.account === 2),
        ).toBe(false)
        expect(removed()).toContain(familyHdKeyId(SEED, 'evm', 2, 0))
    })

    test("keeps the key another flow claimed during the walk when the walk's own add of it fails", async () => {
        activeAt(ALGORAND, [{ account: 0, keyIndex: 0 }])
        activeAt(ETHEREUM, [{ account: 2, keyIndex: 0 }])
        const watcher = buildTestAccount(
            TEST_CUSTODY.watch,
            { [ETHEREUM]: { address: familyHdAddress('evm', 2, 0) } },
            { id: 'watcher' },
        )
        state().setAccounts([pathHolder({ account: 0, keyIndex: 0 }), watcher])
        const algorandProbe = families.checkActivity.get(ALGORAND)!
        const probeActivity = algorandProbe.getMockImplementation()!
        let resumeWalk: (() => void) | undefined
        algorandProbe.mockImplementationOnce(async (probed: string[]) => {
            await new Promise<void>(resolve => {
                resumeWalk = resolve
            })
            return probeActivity(probed)
        })
        const sharedKey = familyHdKeyId(SEED, 'evm', 2, 0)

        const walking = state().discoverWalletAccounts(SEED)
        await vi.waitFor(() => expect(resumeWalk).toBeDefined())
        await deriveClaimedKey(sharedKey, async () => ({
            keyPairId: sharedKey,
        }))
        resumeWalk!()
        await walking

        expect(removed()).not.toContain(sharedKey)
    })

    test('saves the key of an index found in memory only when adding it, and zeroes the root key when the walk ends', async () => {
        deriveInMemoryOn(ALGORAND)
        activeAt(ALGORAND, [{ account: 1, keyIndex: 0 }])
        const rootKey = new Uint8Array([1, 2, 3])

        await state().discoverWalletAccounts(SEED, { rootKey })

        expect(
            vi
                .mocked(families.derivations.get(ALGORAND)!.deriveAccount)
                .mock.calls.map(([, , account, keyIndex]) => [
                    account,
                    keyIndex,
                ]),
        ).toEqual([[1, 0]])
        expect(
            state().accounts.find(account => hdIndexOf(account)?.account === 1)
                ?.chains[ALGORAND],
        ).toMatchObject({
            address: familyHdAddress('algorand', 1, 0),
            keyPairId: familyHdKeyId(SEED, 'algorand', 1, 0),
        })
        expect([...rootKey]).toEqual([0, 0, 0])
    })

    test('removes the key a failed add of an index found in memory derived', async () => {
        deriveInMemoryOn(ALGORAND)
        activeAt(ALGORAND, [{ account: 2, keyIndex: 0 }])
        const watcher = buildTestAccount(
            TEST_CUSTODY.watch,
            { [ALGORAND]: { address: familyHdAddress('algorand', 2, 0) } },
            { id: 'watcher' },
        )
        state().setAccounts([watcher])

        await state().discoverWalletAccounts(SEED, {
            rootKey: new Uint8Array([1]),
        })

        expect(removed()).toContain(familyHdKeyId(SEED, 'algorand', 2, 0))
    })

    test('removes the keys of inactive chains and keeps the ones accounts reference', async () => {
        activeAt(ALGORAND, [{ account: 0, keyIndex: 0 }])
        state().setAccounts([pathHolder({ account: 0, keyIndex: 0 })])

        await state().discoverWalletAccounts(SEED)

        expect(removed()).toContain(familyHdKeyId(SEED, 'evm', 0, 0))
        expect(removed()).toContain(familyHdKeyId(SEED, 'algorand', 0, 1))
        expect(removed()).not.toContain(familyHdKeyId(SEED, 'algorand', 0, 0))
    })

    test("removes a batch's unused keys while the walk is still running", async () => {
        activeAt(ALGORAND, [{ account: 0, keyIndex: 0 }])
        state().setAccounts([pathHolder({ account: 0, keyIndex: 0 })])
        const algorandProbe = families.checkActivity.get(ALGORAND)!
        const probeActivity = algorandProbe.getMockImplementation()!
        const laterBatch = familyHdAddress('algorand', 0, 5)
        let resumeWalk: (() => void) | undefined
        algorandProbe.mockImplementation(async (probed: string[]) => {
            if (probed.includes(laterBatch)) {
                await new Promise<void>(resolve => {
                    resumeWalk = resolve
                })
            }
            return probeActivity(probed)
        })

        const walking = state().discoverWalletAccounts(SEED)
        await vi.waitFor(() => expect(resumeWalk).toBeDefined())
        await vi.waitFor(() =>
            expect(removed()).toContain(familyHdKeyId(SEED, 'evm', 1, 0)),
        )

        expect(removed()).not.toContain(familyHdKeyId(SEED, 'algorand', 0, 0))
        resumeWalk!()
        await walking
    })

    test('resolves to nothing, changing nothing, when every probe fails', async () => {
        for (const probe of families.checkActivity.values()) {
            probe.mockRejectedValue(new Error('offline'))
        }
        const holder = pathHolder({ account: 0, keyIndex: 0 })
        state().setAccounts([holder])

        await expect(state().discoverWalletAccounts(SEED)).resolves.toEqual([])
        expect(state().accounts).toEqual([holder])
    })

    test('changes nothing when run again over the same wallet', async () => {
        activeAt(ALGORAND, [{ account: 0, keyIndex: 0 }])
        activeAt(ETHEREUM, [
            { account: 0, keyIndex: 0 },
            { account: 1, keyIndex: 0 },
        ])
        state().setAccounts([pathHolder({ account: 0, keyIndex: 0 })])
        await state().discoverWalletAccounts(SEED)
        const afterFirst = state().accounts

        await expect(state().discoverWalletAccounts(SEED)).resolves.toEqual([])
        expect(state().accounts).toEqual(afterFirst)
    })

    test('lets an enable on a held account finish before the walk drops the key it derived there', async () => {
        activeAt(ALGORAND, [{ account: 0, keyIndex: 0 }])
        state().setAccounts([pathHolder({ account: 0, keyIndex: 0 })])
        let release: (() => void) | undefined
        vi.mocked(
            families.derivations.get(ETHEREUM)!.deriveAccount,
        ).mockImplementationOnce(async (_kms, seedRef, account, keyIndex) => {
            await new Promise<void>(resolve => {
                release = resolve
            })
            return {
                keyPairId: familyHdKeyId(seedRef, 'evm', account, keyIndex),
                publicKey: familyHdPublicKey('evm', account, keyIndex),
                address: familyHdAddress('evm', account, keyIndex),
            }
        })

        const enabling = state().enableChain('holder-0-0', ETHEREUM, 'user')
        await vi.waitFor(() => expect(release).toBeDefined())
        const walking = state().discoverWalletAccounts(SEED)
        await vi.waitFor(() =>
            expect(families.checkActivity.get(ETHEREUM)).toHaveBeenCalled(),
        )
        release!()
        await Promise.all([enabling, walking])

        expect(state().accounts[0].chains[ETHEREUM]).toMatchObject({
            keyPairId: familyHdKeyId(SEED, 'evm', 0, 0),
            enabledBy: 'user',
        })
        expect(removed()).not.toContain(familyHdKeyId(SEED, 'evm', 0, 0))
    })

    test('keeps the key an account creation derives at an unheld index while the walk cleans up', async () => {
        activeAt(ALGORAND, [{ account: 0, keyIndex: 0 }])
        state().setAccounts([pathHolder({ account: 0, keyIndex: 0 })])
        const algorandProbe = families.checkActivity.get(ALGORAND)!
        const probeActivity = algorandProbe.getMockImplementation()!
        let resumeWalk: (() => void) | undefined
        algorandProbe.mockImplementationOnce(async (probed: string[]) => {
            await new Promise<void>(resolve => {
                resumeWalk = resolve
            })
            return probeActivity(probed)
        })
        const deriveEvm = vi.mocked(
            families.derivations.get(ETHEREUM)!.deriveAccount,
        )
        const deriveFromFixture = deriveEvm.getMockImplementation()!
        let isNextDeriveGated = false
        let finishDerive: (() => void) | undefined
        // A batch may drop the key before the creation derives it again; only
        // a removal after that derive began would lose it.
        let removedBeforeDerive = 0
        deriveEvm.mockImplementation(async (...args) => {
            if (isNextDeriveGated) {
                isNextDeriveGated = false
                removedBeforeDerive = removed().length
                await new Promise<void>(resolve => {
                    finishDerive = resolve
                })
            }
            return deriveFromFixture(...args)
        })

        const walking = state().discoverWalletAccounts(SEED)
        await vi.waitFor(() => expect(resumeWalk).toBeDefined())
        isNextDeriveGated = true
        const creating = state().addChainAccount(SEED, ETHEREUM, {
            account: 1,
            keyIndex: 0,
        })
        await vi.waitFor(() => expect(finishDerive).toBeDefined())
        resumeWalk!()
        await walking
        finishDerive!()
        const created = await creating

        expect(created.chains[ETHEREUM]?.keyPairId).toBe(
            familyHdKeyId(SEED, 'evm', 1, 0),
        )
        expect(removed().slice(removedBeforeDerive)).not.toContain(
            familyHdKeyId(SEED, 'evm', 1, 0),
        )
        expect(removed()).toContain(familyHdKeyId(SEED, 'evm', 2, 0))
    })

    test('adds to the account an earlier import of the same seed holds at that index, not a second account there', async () => {
        const EARLIER_SEED = 'earlier-seed'
        getKeystoreStore().state.keys = [
            ...getKeystoreStore().state.keys,
            { id: EARLIER_SEED, type: 'seed', metadata: { scheme: 'bip39' } },
            {
                id: familyHdKeyId(EARLIER_SEED, 'algorand', 0, 0),
                type: 'ed25519',
                metadata: { parentKeyId: EARLIER_SEED },
            },
        ] as never
        activeAt(ALGORAND, [{ account: 0, keyIndex: 0 }])
        activeAt(ETHEREUM, [{ account: 0, keyIndex: 0 }])
        const earlier = buildTestAccount(
            { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
            {
                [ALGORAND]: {
                    address: familyHdAddress('algorand', 0, 0),
                    keyPairId: familyHdKeyId(EARLIER_SEED, 'algorand', 0, 0),
                },
            },
            { id: 'earlier-0-0' },
        )
        state().setAccounts([earlier])

        await state().discoverWalletAccounts(SEED)

        expect(state().accounts.map(account => account.id)).toEqual([
            'earlier-0-0',
        ])
        expect(state().accounts[0].chains[ETHEREUM]).toMatchObject({
            address: familyHdAddress('evm', 0, 0),
            keyPairId: familyHdKeyId(EARLIER_SEED, 'evm', 0, 0),
            enabledBy: 'discovery',
        })
    })

    test('removes the keys a probe batch saved even when that batch fails', async () => {
        families.checkActivity.get(ETHEREUM)!.mockImplementation(() => {
            throw new Error('adapter broke')
        })

        await expect(state().discoverWalletAccounts(SEED)).resolves.toEqual([])

        expect(removed()).toEqual(
            expect.arrayContaining([
                familyHdKeyId(SEED, 'algorand', 0, 0),
                familyHdKeyId(SEED, 'evm', 0, 0),
            ]),
        )
    })
})
