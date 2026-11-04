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
import { logger, PeraNetworkError } from '@perawallet/wallet-core-shared'
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
    deriveInMemoryOn,
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

    it('probes only the indexes still needed to close a gap, and finds what a full batch would', async () => {
        const probe = vi.fn(probeActiveAt(['0/0']))

        const found = await walkHdTree({ probe })

        expect(found).toEqual([{ account: 0, keyIndex: 0 }])
        const sizes = probe.mock.calls.map(([indices]) => indices.length)
        // Account 0: keys 0-4, then the one key left to close its gap. Accounts
        // 1-4: five keys each. Then only account 5 closes the account gap.
        expect([...sizes].sort()).toEqual([1, 5, 5, 5, 5, 5, 5])
        expect(sizes.reduce((a, b) => a + b)).toBe(31)
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

    it('keeps both gaps open through the indexes the wallet holds, so a walk of some chains still reaches them', async () => {
        const found = await walkHdTree({
            probe: probeActiveAt(['7/0', '0/7']),
            heldIndexes: [
                { account: 6, keyIndex: 0 },
                { account: 0, keyIndex: 6 },
            ],
        })

        expect(found).toEqual([
            { account: 0, keyIndex: 7 },
            { account: 7, keyIndex: 0 },
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

    it('keeps the keys an account index found before a later batch of it rejects', async () => {
        const found = await walkHdTree({
            probe: async indices => {
                if (indices[0].account === 0 && indices[0].keyIndex === 5) {
                    throw new Error('offline')
                }
                return probeActiveAt(['0/0', '0/1', '0/2', '0/3', '0/4'])(
                    indices,
                )
            },
        })

        expect(found).toEqual(
            [0, 1, 2, 3, 4].map(keyIndex => ({ account: 0, keyIndex })),
        )
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

    const walkEveryAddressActive = async (heldIndexes?: HdIndex[]) => {
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
            heldIndexes,
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
        await expect(
            walkEveryAddressActive([{ account: 59, keyIndex: 0 }]),
        ).resolves.toEqual({
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

    it('derives a chain that reads public keys from the root key in memory, saving no key for it', async () => {
        const families = registerChainFamilies([ALGORAND, ETHEREUM])
        const { createPublicKeyGetter } = deriveInMemoryOn(ALGORAND)
        activeOn(families, ALGORAND, [familyHdAddress('algorand', 0, 0)])
        const rootKey = new Uint8Array([1, 2, 3])

        const probed = await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND, ETHEREUM],
            rootKey,
            accountGapLimit: 1,
            keyIndexGapLimit: 1,
        })

        expect(createPublicKeyGetter).toHaveBeenCalledExactlyOnceWith(rootKey)
        expect(
            families.derivations.get(ALGORAND)!.deriveAccount,
        ).not.toHaveBeenCalled()
        expect(
            families.derivations.get(ETHEREUM)!.deriveAccount,
        ).toHaveBeenCalled()
        expect(probed[0].derived).toEqual({
            [ALGORAND]: { address: familyHdAddress('algorand', 0, 0) },
            [ETHEREUM]: {
                address: familyHdAddress('evm', 0, 0),
                keyPairId: familyHdKeyId('seed', 'evm', 0, 0),
            },
        })
        expect(probed[0].active).toEqual({
            [ALGORAND]: { address: familyHdAddress('algorand', 0, 0) },
        })
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

    describe('onProbeSettled', () => {
        const walkOne = async (
            onProbeSettled: (chainId: string, outcome: string) => void,
        ) =>
            discoverWalletActivity({
                walletId: 'seed',
                chainIds: [ETHEREUM],
                accountGapLimit: 1,
                keyIndexGapLimit: 2,
                onProbeSettled,
            })

        it('reports answered for a chain that answers every address', async () => {
            const families = registerChainFamilies([ETHEREUM])
            activeOn(families, ETHEREUM, [])
            const onProbeSettled = vi.fn()

            await walkOne(onProbeSettled)

            expect(onProbeSettled.mock.calls).toEqual([[ETHEREUM, 'answered']])
        })

        it('reports partial when the answer leaves an address out, which reads as inactive', async () => {
            const families = registerChainFamilies([ETHEREUM])
            families.checkActivity
                .get(ETHEREUM)!
                .mockImplementation(
                    async (probed: string[]) => new Map([[probed[0]!, false]]),
                )
            const onProbeSettled = vi.fn()

            const probed = await walkOne(onProbeSettled)

            expect(onProbeSettled.mock.calls).toEqual([[ETHEREUM, 'partial']])
            expect(activeIndexes(probed)).toEqual([])
        })

        it('reports partial when one index fails to derive', async () => {
            const families = registerChainFamilies([ETHEREUM])
            activeOn(families, ETHEREUM, [])
            vi.mocked(
                families.derivations.get(ETHEREUM)!.deriveAccount,
            ).mockRejectedValueOnce(new Error('keystore locked'))
            const onProbeSettled = vi.fn()

            await walkOne(onProbeSettled)

            expect(onProbeSettled.mock.calls).toEqual([[ETHEREUM, 'partial']])
        })

        it('reports failed when the probe rejects', async () => {
            const families = registerChainFamilies([ETHEREUM])
            families.checkActivity
                .get(ETHEREUM)!
                .mockRejectedValue(new Error('rpc down'))
            const onProbeSettled = vi.fn()

            await walkOne(onProbeSettled)

            expect(onProbeSettled.mock.calls).toEqual([[ETHEREUM, 'failed']])
        })

        it('reports refused, logged as info rather than a warning, when the backend has the chain switched off', async () => {
            const families = registerChainFamilies([ETHEREUM])
            families.checkActivity.get(ETHEREUM)!.mockRejectedValue(
                new PeraNetworkError('client', {
                    status: 422,
                    backendCode: 'chain_not_enabled',
                }),
            )
            const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
            const info = vi.spyOn(logger, 'info').mockImplementation(() => {})
            const onProbeSettled = vi.fn()

            await walkOne(onProbeSettled)

            expect(onProbeSettled.mock.calls).toEqual([[ETHEREUM, 'refused']])
            expect(info).toHaveBeenCalledWith(
                'Wallet discovery chain not enabled on the backend',
                { chainId: ETHEREUM },
            )
            expect(warn).not.toHaveBeenCalled()
        })

        it('reports failed when no index derives', async () => {
            const families = registerChainFamilies([ETHEREUM])
            vi.mocked(
                families.derivations.get(ETHEREUM)!.deriveAccount,
            ).mockRejectedValue(new Error('keystore locked'))
            const onProbeSettled = vi.fn()

            await walkOne(onProbeSettled)

            expect(onProbeSettled.mock.calls).toEqual([[ETHEREUM, 'failed']])
        })
    })

    it('starts no batch once aborted, and resolves to what it found before', async () => {
        const families = registerChainFamilies([ALGORAND])
        const controller = new AbortController()
        const algorandProbe = families.checkActivity
            .get(ALGORAND)!
            .mockImplementation(async (probed: string[]) => {
                controller.abort()
                return new Map(probed.map(address => [address, true]))
            })

        const probed = await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND],
            accountGapLimit: 1,
            keyIndexGapLimit: 1,
            signal: controller.signal,
        })

        expect(algorandProbe).toHaveBeenCalledTimes(1)
        expect(activeIndexes(probed)).toEqual([
            [{ account: 0, keyIndex: 0 }, [ALGORAND]],
        ])
    })

    it('reports each batch once every chain has probed it', async () => {
        const families = registerChainFamilies([ALGORAND])
        activeOn(families, ALGORAND, [familyHdAddress('algorand', 0, 0)])
        const onBatchProbed = vi.fn()

        await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND],
            accountGapLimit: 1,
            keyIndexGapLimit: 1,
            onBatchProbed,
        })

        expect(onBatchProbed.mock.calls).toEqual([
            [[{ account: 0, keyIndex: 0 }]],
            [[{ account: 0, keyIndex: 1 }]],
            [[{ account: 1, keyIndex: 0 }]],
        ])
    })

    it('reports a find only once the gaps keep it, never one active past a gap', async () => {
        const families = registerChainFamilies([ALGORAND])
        activeOn(families, ALGORAND, [
            familyHdAddress('algorand', 0, 0),
            familyHdAddress('algorand', 0, 3),
        ])
        const onFound = vi.fn()

        await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND],
            accountGapLimit: 1,
            keyIndexGapLimit: 2,
            onFound,
        })

        expect(
            onFound.mock.calls.flatMap(([entries]) =>
                entries.map((entry: { index: HdIndex }) => entry.index),
            ),
        ).toEqual([{ account: 0, keyIndex: 0 }])
    })

    it('stops probing a chain after its Pera lookups fail twice in a row, and keeps walking the others', async () => {
        const families = registerChainFamilies([ALGORAND, ETHEREUM])
        activeOn(families, ALGORAND, [
            familyHdAddress('algorand', 0, 0),
            familyHdAddress('algorand', 1, 0),
        ])
        const ethereumProbe = families.checkActivity
            .get(ETHEREUM)!
            .mockRejectedValue(new PeraNetworkError('server', { status: 503 }))

        const probed = await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND, ETHEREUM],
            accountGapLimit: 1,
            keyIndexGapLimit: 1,
        })

        expect(ethereumProbe).toHaveBeenCalledTimes(2)
        expect(activeIndexes(probed)).toEqual([
            [{ account: 0, keyIndex: 0 }, [ALGORAND]],
            [{ account: 1, keyIndex: 0 }, [ALGORAND]],
        ])
    })

    it('asks a batch once more when a Pera lookup times out, and keeps a chain that then answers', async () => {
        const families = registerChainFamilies([ETHEREUM])
        activeOn(families, ETHEREUM, [familyHdAddress('evm', 0, 0)])
        families.checkActivity
            .get(ETHEREUM)!
            .mockRejectedValueOnce(new PeraNetworkError('timeout'))
        const onProbeSettled = vi.fn()

        const probed = await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ETHEREUM],
            accountGapLimit: 1,
            keyIndexGapLimit: 1,
            onProbeSettled,
        })

        expect(onProbeSettled).not.toHaveBeenCalledWith(ETHEREUM, 'failed')
        expect(activeIndexes(probed)).toEqual([
            [{ account: 0, keyIndex: 0 }, [ETHEREUM]],
        ])
    })

    it.each([
        [
            'a refusal',
            new PeraNetworkError('client', {
                status: 422,
                backendCode: 'chain_not_enabled',
            }),
        ],
        ['a 4xx', new PeraNetworkError('client', { status: 403 })],
        [
            'a node error, which its client already retried',
            new Error('rpc down'),
        ],
    ])(
        'asks a batch only once when its probe fails with %s',
        async (_, error) => {
            const families = registerChainFamilies([ETHEREUM])
            const probe = families.checkActivity
                .get(ETHEREUM)!
                .mockRejectedValue(error)

            await discoverWalletActivity({
                walletId: 'seed',
                chainIds: [ETHEREUM],
                accountGapLimit: 1,
                keyIndexGapLimit: 1,
            })

            expect(probe).toHaveBeenCalledOnce()
        },
    )

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

    describe('a chain that cannot answer in time', () => {
        afterEach(() => {
            vi.useRealTimers()
        })

        const neverAnswers = () => new Promise<Map<string, boolean>>(() => {})

        const walkWithHungChain = async (onProbeSettled = vi.fn()) => {
            vi.useFakeTimers()
            const families = registerChainFamilies([ALGORAND, ETHEREUM])
            activeOn(families, ALGORAND, [
                familyHdAddress('algorand', 0, 0),
                familyHdAddress('algorand', 1, 0),
            ])
            const hungProbe = families.checkActivity
                .get(ETHEREUM)!
                .mockImplementation(neverAnswers)
            const walk = discoverWalletActivity({
                walletId: 'seed',
                chainIds: [ALGORAND, ETHEREUM],
                accountGapLimit: 1,
                keyIndexGapLimit: 1,
                onProbeSettled,
            })
            await vi.advanceTimersByTimeAsync(4000)
            return { probed: await walk, hungProbe, families, onProbeSettled }
        }

        it('is reported failed after four seconds, keeps the other chains walking and is not probed again', async () => {
            const { probed, hungProbe, onProbeSettled } =
                await walkWithHungChain()

            expect(onProbeSettled).toHaveBeenCalledWith(ETHEREUM, 'failed')
            expect(hungProbe).toHaveBeenCalledOnce()
            expect(activeIndexes(probed)).toEqual([
                [{ account: 0, keyIndex: 0 }, [ALGORAND]],
                [{ account: 1, keyIndex: 0 }, [ALGORAND]],
            ])
        })

        it('has its lookups aborted, while a healthy chain keeps a live signal', async () => {
            const { hungProbe, families } = await walkWithHungChain()

            expect(hungProbe.mock.calls[0]![2]!.aborted).toBe(true)
            expect(
                families.checkActivity
                    .get(ALGORAND)!
                    .mock.calls.every(([, , signal]) => !signal!.aborted),
            ).toBe(true)
        })

        it('is not cut while it keeps answering batches, however long the later ones queued behind the earlier', async () => {
            vi.useFakeTimers()
            const families = registerChainFamilies([ETHEREUM])
            let call = 0
            families.checkActivity
                .get(ETHEREUM)!
                .mockImplementation(
                    (probed: string[]) =>
                        new Promise(resolve =>
                            setTimeout(
                                () =>
                                    resolve(
                                        new Map(probed.map(a => [a, false])),
                                    ),
                                ++call * 3000,
                            ),
                        ),
                )
            const onProbeSettled = vi.fn()
            const walk = discoverWalletActivity({
                walletId: 'seed',
                chainIds: [ETHEREUM],
                accountGapLimit: 2,
                keyIndexGapLimit: 1,
                onProbeSettled,
            })

            // The second batch answers at 6s, more than 4s after it started.
            await vi.advanceTimersByTimeAsync(6000)
            await walk

            expect(onProbeSettled.mock.calls).toEqual([
                [ETHEREUM, 'answered'],
                [ETHEREUM, 'answered'],
            ])
        })

        it('is not cut while another chain keeps answering, however long its own first answer takes', async () => {
            vi.useFakeTimers()
            const families = registerChainFamilies([ALGORAND, ETHEREUM])
            const answerAfter = (stepMs: number) => {
                let call = 0
                return (probed: string[]) =>
                    new Promise<Map<string, boolean>>(resolve =>
                        setTimeout(
                            () => resolve(new Map(probed.map(a => [a, false]))),
                            stepMs * ++call,
                        ),
                    )
            }
            // Algorand answers at 2s, 4s and 6s. Ethereum, waiting its turn
            // behind it, first answers at 6s: more than 4s after the walk began.
            families.checkActivity
                .get(ALGORAND)!
                .mockImplementation(answerAfter(2000))
            families.checkActivity
                .get(ETHEREUM)!
                .mockImplementation(
                    (probed: string[]) =>
                        new Promise(resolve =>
                            setTimeout(
                                () =>
                                    resolve(
                                        new Map(probed.map(a => [a, false])),
                                    ),
                                6000,
                            ),
                        ),
                )
            const onProbeSettled = vi.fn()
            const walk = discoverWalletActivity({
                walletId: 'seed',
                chainIds: [ALGORAND, ETHEREUM],
                accountGapLimit: 3,
                keyIndexGapLimit: 1,
                onProbeSettled,
            })

            await vi.advanceTimersByTimeAsync(6000)
            await walk

            expect(onProbeSettled).not.toHaveBeenCalledWith(
                expect.anything(),
                'failed',
            )
        })

        it('cuts no chain before the first answer, so a link where every network first answers late still finds the active index', async () => {
            vi.useFakeTimers()
            const families = registerChainFamilies([ALGORAND, ETHEREUM])
            const firstAnswerAfter = (delayMs: number, active: string[]) => {
                let isFirst = true
                return (probed: string[]) => {
                    const answer = new Map(
                        probed.map(a => [a, active.includes(a)]),
                    )
                    if (!isFirst) return Promise.resolve(answer)
                    isFirst = false
                    return new Promise<Map<string, boolean>>(resolve =>
                        setTimeout(() => resolve(answer), delayMs),
                    )
                }
            }
            families.checkActivity
                .get(ALGORAND)!
                .mockImplementation(
                    firstAnswerAfter(6000, [familyHdAddress('algorand', 0, 0)]),
                )
            families.checkActivity
                .get(ETHEREUM)!
                .mockImplementation(firstAnswerAfter(7000, []))
            const onProbeSettled = vi.fn()
            const walk = discoverWalletActivity({
                walletId: 'seed',
                chainIds: [ALGORAND, ETHEREUM],
                accountGapLimit: 1,
                keyIndexGapLimit: 1,
                onProbeSettled,
            })

            await vi.advanceTimersByTimeAsync(7000)
            const probed = await walk

            expect(onProbeSettled).not.toHaveBeenCalledWith(
                expect.anything(),
                'failed',
            )
            expect(activeIndexes(probed)).toEqual([
                [{ account: 0, keyIndex: 0 }, [ALGORAND]],
            ])
        })

        it('adds nothing when it answers after being cut', async () => {
            vi.useFakeTimers()
            const families = registerChainFamilies([ALGORAND, ETHEREUM])
            activeOn(families, ALGORAND, [])
            let answerLate: (answer: Map<string, boolean>) => void = () =>
                undefined
            families.checkActivity.get(ETHEREUM)!.mockImplementation(
                (probed: string[]) =>
                    new Promise(resolve => {
                        answerLate = () =>
                            resolve(new Map(probed.map(a => [a, true])))
                    }),
            )
            const walk = discoverWalletActivity({
                walletId: 'seed',
                chainIds: [ALGORAND, ETHEREUM],
                accountGapLimit: 1,
                keyIndexGapLimit: 1,
            })

            await vi.advanceTimersByTimeAsync(4000)
            answerLate(new Map())

            expect(activeIndexes(await walk)).toEqual([])
        })
    })

    it('aborts the lookups of a chain whose probe failed twice', async () => {
        const families = registerChainFamilies([ETHEREUM])
        const probe = families.checkActivity
            .get(ETHEREUM)!
            .mockRejectedValue(new PeraNetworkError('server', { status: 503 }))

        await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ETHEREUM],
            accountGapLimit: 1,
            keyIndexGapLimit: 1,
        })

        expect(probe).toHaveBeenCalledTimes(2)
        expect(probe.mock.calls[1]![2]!.aborted).toBe(true)
    })

    it('keeps a refused chain refused when its other batches then fail on the abort', async () => {
        const families = registerChainFamilies([ETHEREUM])
        families.checkActivity
            .get(ETHEREUM)!
            .mockImplementationOnce(
                () =>
                    new Promise((_, reject) =>
                        setTimeout(
                            () =>
                                reject(
                                    new PeraNetworkError('client', {
                                        status: 422,
                                        backendCode: 'chain_not_enabled',
                                    }),
                                ),
                            5,
                        ),
                    ),
            )
            .mockImplementationOnce(
                (_: string[], __: unknown, signal: AbortSignal) =>
                    new Promise((_, reject) =>
                        signal.addEventListener('abort', () =>
                            reject(new Error('Activity lookup abandoned')),
                        ),
                    ),
            )
        const onProbeSettled = vi.fn()

        await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ETHEREUM],
            accountGapLimit: 2,
            keyIndexGapLimit: 1,
            onProbeSettled,
        })

        expect(onProbeSettled.mock.calls).toEqual([
            [ETHEREUM, 'refused'],
            [ETHEREUM, 'refused'],
        ])
    })

    it('keeps a refused chain refused when another batch of it resolves partly after the abort', async () => {
        const families = registerChainFamilies([ETHEREUM])
        families.checkActivity
            .get(ETHEREUM)!
            .mockImplementationOnce(
                () =>
                    new Promise((_, reject) =>
                        setTimeout(
                            () =>
                                reject(
                                    new PeraNetworkError('client', {
                                        status: 422,
                                        backendCode: 'chain_not_enabled',
                                    }),
                                ),
                            5,
                        ),
                    ),
            )
            .mockImplementationOnce(
                () =>
                    new Promise(resolve =>
                        setTimeout(() => resolve(new Map()), 20),
                    ),
            )
        const onProbeSettled = vi.fn()

        await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ETHEREUM],
            accountGapLimit: 2,
            keyIndexGapLimit: 1,
            onProbeSettled,
        })

        expect(onProbeSettled.mock.calls).toEqual([
            [ETHEREUM, 'refused'],
            [ETHEREUM, 'refused'],
        ])
    })

    it('does not retry a batch once a concurrent batch has cut its chain', async () => {
        const families = registerChainFamilies([ETHEREUM])
        const probe = families.checkActivity
            .get(ETHEREUM)!
            .mockRejectedValueOnce(new Error('rpc down'))
            .mockImplementationOnce(
                () =>
                    new Promise((_, reject) =>
                        setTimeout(
                            () => reject(new PeraNetworkError('timeout')),
                            10,
                        ),
                    ),
            )

        await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ETHEREUM],
            accountGapLimit: 2,
            keyIndexGapLimit: 1,
        })

        expect(probe).toHaveBeenCalledTimes(2)
    })

    it('leaves every chain unaborted and unfailed when the walk itself is cancelled', async () => {
        const families = registerChainFamilies([ALGORAND, ETHEREUM])
        const controller = new AbortController()
        activeOn(families, ETHEREUM, [])
        const algorandProbe = families.checkActivity
            .get(ALGORAND)!
            .mockImplementation(async (probed: string[]) => {
                controller.abort()
                return new Map(probed.map(address => [address, false]))
            })
        const onProbeSettled = vi.fn()

        await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND, ETHEREUM],
            accountGapLimit: 1,
            keyIndexGapLimit: 1,
            signal: controller.signal,
            onProbeSettled,
        })

        expect(algorandProbe.mock.calls[0]![2]!.aborted).toBe(false)
        expect(onProbeSettled).not.toHaveBeenCalledWith(
            expect.anything(),
            'failed',
        )
    })

    it('logs one timing line per walk, with each chain that answered and each one that was cut', async () => {
        const families = registerChainFamilies([ALGORAND, ETHEREUM])
        families.checkActivity
            .get(ETHEREUM)!
            .mockRejectedValue(new Error('rpc down'))
        const info = vi.spyOn(logger, 'info').mockImplementation(() => {})

        await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND, ETHEREUM],
            accountGapLimit: 1,
            keyIndexGapLimit: 1,
        })

        const timings = info.mock.calls.filter(
            ([message]) => message === 'Wallet discovery walk timings',
        )
        expect(timings).toHaveLength(1)
        expect(timings[0]![1]).toMatchObject({
            probedIndexes: 1,
            chains: { [ALGORAND]: { batches: 1 } },
            cutChains: { [ETHEREUM]: 'failed' },
        })
    })

    it('calls onProbeAnswered once per resolved activity probe, never for a rejected one', async () => {
        const families = registerChainFamilies([ALGORAND, ETHEREUM])
        families.checkActivity
            .get(ETHEREUM)!
            .mockRejectedValue(new Error('rpc down'))
        const onProbeAnswered = vi.fn()

        await discoverWalletActivity({
            walletId: 'seed',
            chainIds: [ALGORAND, ETHEREUM],
            onProbeAnswered,
            accountGapLimit: 1,
            keyIndexGapLimit: 2,
        })

        // Two batches of keys, each answered by Algorand alone.
        expect(onProbeAnswered).toHaveBeenCalledTimes(
            families.checkActivity.get(ALGORAND)!.mock.calls.length,
        )
        expect(onProbeAnswered).toHaveBeenCalled()
    })
})
