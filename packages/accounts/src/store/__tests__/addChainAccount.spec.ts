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

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
    addressCodecs,
    CHAIN_CAPABILITIES,
    keyDerivations,
    type ChainCapabilities,
    type ChainDescriptor,
} from '@perawallet/wallet-core-chain-contract'
import {
    createFakeChainKeyStore,
    FIXTURE_CHAIN_ID,
    fixtureCodec,
    fixtureDerivation,
} from '@perawallet/wallet-core-chain-contract/testing'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { kmsCore } from '@perawallet/wallet-core-kms'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import { accountsChainAdapters } from '../../chain-adapter'
import { buildAccount } from '../../credentials'
import { DuplicateAccountError, WalletCannotDeriveError } from '../../errors'
import type { HdIndex, WalletAccount } from '../../models'
import { buildTestAccount } from '../../__tests__/accountFactory'
import {
    FAKE_CHAIN_ID,
    fakeAccountsChain,
} from '../../__tests__/fakeAccountsChain'
import { useAccountsStore } from '../store'

const ORIGIN: HdIndex = { account: 0, keyIndex: 0 }
const FREE: HdIndex = { account: 1, keyIndex: 0 }

describe('addChainAccount', () => {
    let kms: ReturnType<typeof createFakeChainKeyStore>
    let derive: ReturnType<typeof vi.spyOn>
    let holder: WalletAccount

    const state = () => useAccountsStore.getState()
    const add = (index: HdIndex, name?: string, walletId = 'hd-seed') =>
        state().addChainAccount(walletId, FIXTURE_CHAIN_ID, index, name)

    const fixtureAddressAt = async (index: HdIndex) =>
        (
            await fixtureDerivation.deriveAccount(
                createFakeChainKeyStore(),
                'hd-seed',
                index.account,
                index.keyIndex,
                { scheme: 'ed25519', networkId: 'mainnet' },
            )
        ).address

    beforeEach(() => {
        getKeystoreStore().state.keys = [
            { id: 'hd-seed', type: 'seed', metadata: { scheme: 'bip39' } },
            { id: 'algo25-seed', type: 'seed', metadata: { scheme: 'algo25' } },
            {
                id: 'quantum-seed',
                type: 'seed',
                metadata: { scheme: 'quantum' },
            },
            {
                id: 'hd-key',
                type: 'ed25519',
                metadata: { parentKeyId: 'hd-seed' },
            },
            {
                id: 'algo25-key',
                type: 'ed25519',
                metadata: { parentKeyId: 'algo25-seed' },
            },
            {
                id: 'quantum-key',
                type: 'falcon-1024',
                metadata: { parentKeyId: 'quantum-seed' },
            },
        ] as never
        getProvider().chains.register(
            {
                id: FIXTURE_CHAIN_ID,
                networks: [
                    {
                        id: 'mainnet',
                        tier: 'mainnet',
                        isDefaultForTier: true,
                        status: 'active',
                    },
                    {
                        id: 'testnet',
                        tier: 'testnet',
                        isDefaultForTier: true,
                        status: 'active',
                    },
                ],
                signing: {
                    schemes: ['ed25519'],
                    derivationPaths: {
                        ed25519: (account: number, keyIndex: number) =>
                            `m/44'/9999'/${account}'/0/${keyIndex}`,
                    },
                    rawKeySchemes: [],
                },
            } as unknown as ChainDescriptor,
            Object.fromEntries(
                CHAIN_CAPABILITIES.map(capability => [capability, false]),
            ) as ChainCapabilities,
        )
        addressCodecs.register(fixtureCodec)
        keyDerivations.register(fixtureDerivation)
        accountsChainAdapters.register({
            ...fakeAccountsChain().adapter,
            chainId: FIXTURE_CHAIN_ID,
            legacyDetails: () => ({}),
        })
        kms = createFakeChainKeyStore()
        derive = vi
            .spyOn(kmsCore, 'deriveFromSeed')
            .mockImplementation(kms.deriveFromSeed)
        useNetworkStore.getState().setMode('live')
        state().resetState()
        holder = { ...buildTestAccount('hdWallet'), name: 'Main' }
        state().setAccounts([holder])
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    test('adds the chain entry to the account holding the position', async () => {
        const result = await add(ORIGIN, 'Ignored')

        const [stored] = state().accounts
        expect(state().accounts).toHaveLength(1)
        expect(result).toEqual(stored)
        expect(stored.id).toBe(holder.id)
        expect(stored.name).toBe('Main')
        expect(stored.chains?.[FAKE_CHAIN_ID]).toEqual(
            holder.chains?.[FAKE_CHAIN_ID],
        )
        expect(stored.chains?.[FIXTURE_CHAIN_ID]).toEqual({
            address: await fixtureAddressAt(ORIGIN),
            keyPairId: 'hd-seed-fx-0-0',
        })
        expect(kms.derivations).toEqual([
            {
                scheme: 'ed25519',
                path: "m/44'/9999'/0'/0/0",
                id: 'hd-seed-fx-0-0',
            },
        ])
    })

    test('creates an account with only that chain at a free position', async () => {
        const result = await add(FREE, 'Second')

        expect(state().accounts).toHaveLength(2)
        expect(state().accounts[0]).toEqual(holder)
        expect(result.name).toBe('Second')
        expect(result.custody).toEqual({
            kind: 'local',
            seed: 'bip39',
            hd: FREE,
        })
        expect(Object.keys(result.chains ?? {})).toEqual([FIXTURE_CHAIN_ID])
    })

    test('derives the same address after the account is removed and added again', async () => {
        const first = await add(FREE)
        state().setAccounts([holder])

        const again = await add(FREE)

        expect(again.chains?.[FIXTURE_CHAIN_ID]).toEqual(
            first.chains?.[FIXTURE_CHAIN_ID],
        )
    })

    test('derives for the chain default testnet in developer mode', async () => {
        useNetworkStore.getState().setMode('developer')

        const result = await add(ORIGIN)

        expect(result.chains?.[FIXTURE_CHAIN_ID]?.address).toMatch(/^tfx/)
    })

    test.each(['algo25-seed', 'quantum-seed', 'device-1'])(
        'refuses wallet %s before the KMS is called',
        async walletId => {
            state().setAccounts([
                holder,
                buildTestAccount('standalone'),
                buildTestAccount('quantum'),
                buildTestAccount('hardware'),
            ])
            const before = state().accounts

            const failure = await add(ORIGIN, undefined, walletId).catch(
                (error: unknown) => error,
            )

            expect(failure).toBeInstanceOf(WalletCannotDeriveError)
            expect(
                (failure as WalletCannotDeriveError).metadata.messageKey,
            ).toBe('errors.account.generic')
            expect(derive).not.toHaveBeenCalled()
            expect(state().accounts).toBe(before)
        },
    )

    test('refuses an unregistered chain before the KMS is called', async () => {
        await expect(
            state().addChainAccount('hd-seed', 'unregistered' as never, ORIGIN),
        ).rejects.toBeInstanceOf(WalletCannotDeriveError)
        expect(derive).not.toHaveBeenCalled()
    })

    test('names the account that already holds the derived address', async () => {
        const watch = buildAccount({
            custody: { kind: 'watch' },
            chainId: FIXTURE_CHAIN_ID,
            chains: {
                [FIXTURE_CHAIN_ID]: { address: await fixtureAddressAt(FREE) },
            },
        })
        state().setAccounts([holder, watch])
        const before = state().accounts

        const failure = await add(FREE).catch((error: unknown) => error)

        expect(failure).toBeInstanceOf(DuplicateAccountError)
        expect(
            (failure as DuplicateAccountError).metadata.params,
        ).toMatchObject({ existingAccountId: watch.id })
        expect(state().accounts).toBe(before)
    })

    test('refuses a second add of the same chain at a position', async () => {
        await add(ORIGIN)

        const failure = await add(ORIGIN).catch((error: unknown) => error)

        expect(failure).toBeInstanceOf(DuplicateAccountError)
        expect(
            (failure as DuplicateAccountError).metadata.params,
        ).toMatchObject({ existingAccountId: holder.id })
    })

    test('refuses a holder that already has a different entry on the chain', async () => {
        const withEntry = {
            ...holder,
            chains: {
                ...holder.chains,
                [FIXTURE_CHAIN_ID]: { address: 'fx' + '00'.repeat(20) },
            },
        }
        state().setAccounts([withEntry])
        const before = state().accounts

        const failure = await add(ORIGIN).catch((error: unknown) => error)

        expect(failure).toBeInstanceOf(DuplicateAccountError)
        expect(
            (failure as DuplicateAccountError).metadata.params,
        ).toMatchObject({ existingAccountId: holder.id })
        expect(state().accounts).toBe(before)
    })

    test('leaves the accounts unchanged when the KMS rejects', async () => {
        derive.mockRejectedValueOnce(new Error('kms down'))
        const before = state().accounts

        await expect(add(ORIGIN)).rejects.toThrow('kms down')
        expect(state().accounts).toBe(before)
    })
})
