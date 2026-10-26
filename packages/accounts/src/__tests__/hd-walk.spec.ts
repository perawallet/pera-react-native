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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@perawallet/wallet-core-shared'
import {
    discoverWalletActivity,
    walkHdTree,
    type HdBatchProbe,
    type ProbedHdIndex,
} from '../hd-walk'
import type { HdIndex } from '../models'
import {
    ALGORAND,
    BASE,
    ETHEREUM,
    familyHdAddress,
    familyHdKeyId,
    registerChainFamilies,
} from './chainFamilies'

const probeActiveAt =
    (active: readonly string[]): HdBatchProbe =>
    async indices =>
        indices.map(({ account, keyIndex }) =>
            active.includes(`${account}/${keyIndex}`),
        )

describe('walkHdTree', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('stops an account index after five empty keys and the walk after five empty account indexes', async () => {
        const probe = vi.fn(probeActiveAt([]))

        const found = await walkHdTree({ probe })

        expect(found).toEqual([])
        const probed = probe.mock.calls.flatMap(([indices]) => indices)
        expect(probed).toHaveLength(25)
        expect(Math.max(...probed.map(index => index.account))).toBe(4)
        expect(Math.max(...probed.map(index => index.keyIndex))).toBe(4)
    })

    it('resets the key gap on activity, so a key past the first batch is found', async () => {
        const found = await walkHdTree({
            probe: probeActiveAt(['0/3', '0/7']),
        })

        expect(found).toEqual([
            { account: 0, keyIndex: 3 },
            { account: 0, keyIndex: 7 },
        ])
    })

    it('resets the account gap on activity, so an account after empty ones is found', async () => {
        const found = await walkHdTree({
            probe: probeActiveAt(['0/0', '4/0', '8/1']),
        })

        expect(found).toEqual([
            { account: 0, keyIndex: 0 },
            { account: 4, keyIndex: 0 },
            { account: 8, keyIndex: 1 },
        ])
    })

    it('counts an account index whose probe rejects as empty', async () => {
        const found = await walkHdTree({
            probe: async indices => {
                if (indices[0].account === 1) throw new Error('offline')
                return probeActiveAt(['0/0', '2/0'])(indices)
            },
        })

        expect(found).toEqual([
            { account: 0, keyIndex: 0 },
            { account: 2, keyIndex: 0 },
        ])
    })

    it('stops at its index limits and warns when every address reads as active', async () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        const probe = vi.fn<HdBatchProbe>(async indices =>
            indices.map(() => true),
        )

        const found = await walkHdTree({
            probe,
            accountIndexLimit: 50,
            keyIndexLimit: 20,
        })

        const probed = probe.mock.calls.flatMap(([indices]) => indices)
        expect(probed).toHaveLength(50 * 20)
        expect(found).toHaveLength(50 * 20)
        expect(Math.max(...probed.map(index => index.account))).toBe(49)
        expect(Math.max(...probed.map(index => index.keyIndex))).toBe(19)
        expect(warn).toHaveBeenCalledOnce()
    })

    it('stops at limits that are not a multiple of the gaps without probing past them', async () => {
        const probe = vi.fn<HdBatchProbe>(async indices =>
            indices.map(() => true),
        )

        await walkHdTree({ probe, accountIndexLimit: 7, keyIndexLimit: 3 })

        const probed = probe.mock.calls.flatMap(([indices]) => indices)
        expect(probed).toHaveLength(7 * 3)
        expect(Math.max(...probed.map(index => index.account))).toBe(6)
        expect(Math.max(...probed.map(index => index.keyIndex))).toBe(2)
    })

    it('does not warn when the gaps end the walk', async () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})

        await walkHdTree({ probe: probeActiveAt(['0/0', '1/4']) })

        expect(warn).not.toHaveBeenCalled()
    })

    it('returns the active indexes by account, then key index', async () => {
        const found = await walkHdTree({
            probe: probeActiveAt(['1/0', '0/2', '0/0', '1/1']),
        })

        expect(found).toEqual<HdIndex[]>([
            { account: 0, keyIndex: 0 },
            { account: 0, keyIndex: 2 },
            { account: 1, keyIndex: 0 },
            { account: 1, keyIndex: 1 },
        ])
    })
})

describe('discoverWalletActivity', () => {
    const activeOn = (
        families: ReturnType<typeof registerChainFamilies>,
        chainId: typeof ALGORAND,
        addresses: readonly string[],
    ) =>
        families.checkActivity
            .get(chainId)!
            .mockImplementation(
                async (probed: string[]) =>
                    new Map(probed.map(a => [a, addresses.includes(a)])),
            )

    const activeIndexes = (probed: ProbedHdIndex[]) =>
        probed.flatMap(({ index, active }) =>
            Object.keys(active).length > 0
                ? [[index, Object.keys(active)]]
                : [],
        )

    it('finds an index active on one chain only, holding just that chain', async () => {
        const families = registerChainFamilies([ALGORAND, ETHEREUM])
        activeOn(families, ALGORAND, [familyHdAddress('algorand', 0, 0)])
        activeOn(families, ETHEREUM, [familyHdAddress('evm', 2, 0)])

        const probed = await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND, ETHEREUM],
        })

        expect(
            probed.filter(({ active }) => Object.keys(active).length > 0),
        ).toEqual([
            expect.objectContaining({
                index: { account: 0, keyIndex: 0 },
                active: {
                    [ALGORAND]: {
                        address: familyHdAddress('algorand', 0, 0),
                        keyPairId: familyHdKeyId('seed', 'algorand', 0, 0),
                    },
                },
            }),
            expect.objectContaining({
                index: { account: 2, keyIndex: 0 },
                active: {
                    [ETHEREUM]: {
                        address: familyHdAddress('evm', 2, 0),
                        keyPairId: familyHdKeyId('seed', 'evm', 2, 0),
                    },
                },
            }),
        ])
    })

    it("hands over each batch's unused keys once its probes resolve, keeping the active ones", async () => {
        const families = registerChainFamilies([ALGORAND, ETHEREUM])
        activeOn(families, ALGORAND, [familyHdAddress('algorand', 0, 0)])
        const onUnusedKeys = vi.fn(async () => {})

        await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND, ETHEREUM],
            onUnusedKeys,
            accountGapLimit: 1,
            keyIndexGapLimit: 2,
        })

        expect(onUnusedKeys.mock.calls).toEqual([
            [
                [
                    familyHdKeyId('seed', 'evm', 0, 0),
                    familyHdKeyId('seed', 'algorand', 0, 1),
                    familyHdKeyId('seed', 'evm', 0, 1),
                ],
            ],
            [
                [
                    familyHdKeyId('seed', 'algorand', 0, 2),
                    familyHdKeyId('seed', 'evm', 0, 2),
                    familyHdKeyId('seed', 'algorand', 0, 3),
                    familyHdKeyId('seed', 'evm', 0, 3),
                ],
            ],
            [
                [
                    familyHdKeyId('seed', 'algorand', 1, 0),
                    familyHdKeyId('seed', 'evm', 1, 0),
                    familyHdKeyId('seed', 'algorand', 1, 1),
                    familyHdKeyId('seed', 'evm', 1, 1),
                ],
            ],
        ])
    })

    const walkEveryAddressActive = async (heldAccountIndex?: number) => {
        const families = registerChainFamilies([ALGORAND])
        families.checkActivity
            .get(ALGORAND)!
            .mockImplementation(
                async (probed: string[]) =>
                    new Map(probed.map(address => [address, true])),
            )
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        const probed = await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND],
            heldAccountIndex,
        })
        warn.mockRestore()
        return {
            highestAccount: Math.max(
                ...probed.map(({ index }) => index.account),
            ),
            highestKeyIndex: Math.max(
                ...probed.map(({ index }) => index.keyIndex),
            ),
        }
    }

    it('stops at its hard limits when a node reports every address active', async () => {
        await expect(walkEveryAddressActive()).resolves.toEqual({
            highestAccount: 49,
            highestKeyIndex: 19,
        })
    })

    it('reaches past the highest account index the wallet already holds', async () => {
        await expect(walkEveryAddressActive(59)).resolves.toEqual({
            highestAccount: 64,
            highestKeyIndex: 19,
        })
    })

    it('reports every index it probed with the keys it derived there, inactive ones included', async () => {
        registerChainFamilies([ALGORAND, ETHEREUM])

        const probed = await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND, ETHEREUM],
            accountGapLimit: 1,
            keyIndexGapLimit: 2,
        })

        expect(activeIndexes(probed)).toEqual([])
        expect(
            probed.map(({ index, derived }) => [
                index,
                Object.values(derived).map(entry => entry!.keyPairId),
            ]),
        ).toEqual([
            [
                { account: 0, keyIndex: 0 },
                [
                    familyHdKeyId('seed', 'algorand', 0, 0),
                    familyHdKeyId('seed', 'evm', 0, 0),
                ],
            ],
            [
                { account: 0, keyIndex: 1 },
                [
                    familyHdKeyId('seed', 'algorand', 0, 1),
                    familyHdKeyId('seed', 'evm', 0, 1),
                ],
            ],
        ])
    })

    it('derives each key once per index, however many chains of its family share it', async () => {
        const families = registerChainFamilies([ALGORAND, ETHEREUM, BASE])

        const probed = await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND, ETHEREUM, BASE],
            accountGapLimit: 1,
            keyIndexGapLimit: 2,
        })

        const evmDerivations = [ETHEREUM, BASE].flatMap(
            chainId =>
                vi.mocked(families.derivations.get(chainId)!.deriveAccount).mock
                    .calls,
        )
        expect(
            evmDerivations.map(([, , account, keyIndex]) => [
                account,
                keyIndex,
            ]),
        ).toEqual([
            [0, 0],
            [0, 1],
        ])
        expect(probed[0].derived[BASE]).toEqual(probed[0].derived[ETHEREUM])
    })

    it("reads a chain whose probe rejects as inactive, keeping the other chains' answers", async () => {
        const families = registerChainFamilies([ETHEREUM, BASE])
        activeOn(families, ETHEREUM, [familyHdAddress('evm', 0, 0)])
        families.checkActivity
            .get(BASE)!
            .mockRejectedValue(new Error('rpc down'))

        const probed = await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ETHEREUM, BASE],
        })

        expect(activeIndexes(probed)).toEqual([
            [{ account: 0, keyIndex: 0 }, [ETHEREUM]],
        ])
    })

    it('reads a chain whose derivation rejects as inactive there', async () => {
        const families = registerChainFamilies([ALGORAND, ETHEREUM])
        activeOn(families, ALGORAND, [familyHdAddress('algorand', 0, 0)])
        activeOn(families, ETHEREUM, [familyHdAddress('evm', 0, 0)])
        vi.mocked(
            families.derivations.get(ETHEREUM)!.deriveAccount,
        ).mockRejectedValue(new Error('keystore locked'))

        const probed = await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND, ETHEREUM],
        })

        expect(activeIndexes(probed)).toEqual([
            [{ account: 0, keyIndex: 0 }, [ALGORAND]],
        ])
        expect(probed[0].derived[ETHEREUM]).toBeUndefined()
    })

    it('still reports the keys a batch derived when its probe throws', async () => {
        const families = registerChainFamilies([ALGORAND, ETHEREUM])
        families.checkActivity.get(ETHEREUM)!.mockImplementation(() => {
            throw new Error('adapter broke')
        })

        const probed = await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND, ETHEREUM],
            accountGapLimit: 1,
            keyIndexGapLimit: 2,
        })

        expect(
            probed.map(({ index, derived }) => [
                index,
                Object.values(derived).map(entry => entry!.keyPairId),
            ]),
        ).toEqual([
            [
                { account: 0, keyIndex: 0 },
                [
                    familyHdKeyId('seed', 'algorand', 0, 0),
                    familyHdKeyId('seed', 'evm', 0, 0),
                ],
            ],
            [
                { account: 0, keyIndex: 1 },
                [
                    familyHdKeyId('seed', 'algorand', 0, 1),
                    familyHdKeyId('seed', 'evm', 0, 1),
                ],
            ],
        ])
        expect(activeIndexes(probed)).toEqual([])
    })
})
