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
import { kmsCore } from '@perawallet/wallet-core-kms'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import {
    AccountNotFoundError,
    AddressMismatchError,
    ChainNotEligibleError,
    DeviceAddressRequiredError,
    DuplicateAccountError,
} from '../../errors'
import { buildTestAccount, TEST_CUSTODY } from '../../__tests__/accountFactory'
import {
    ALGORAND,
    ALGORAND_ADDRESS,
    BASE,
    ETHEREUM,
    EVM_KEY_ADDRESS,
    EVM_KEY_ID,
    familyHdAddress,
    familyHdKeyId,
    POLYGON,
    registerChainFamilies,
    type ChainFamilies,
} from '../../__tests__/chainFamilies'
import { useAccountsStore } from '../store'

const ledgerApps = vi.hoisted(() => new Set<string>())

vi.mock('@perawallet/wallet-core-hardware-wallet', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-hardware-wallet')
    >()),
    hasLedgerAppDriver: (chainId: string) => ledgerApps.has(chainId),
}))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-kms')>()
    return {
        ...actual,
        kmsCore: {
            ...actual.kmsCore,
            getKey: vi.fn((id: string) =>
                id === 'raw-evm-key'
                    ? { id, publicKey: new Uint8Array(20).fill(0xe0) }
                    : null,
            ),
        },
    }
})

const HD_INDEX = { account: 2, keyIndex: 1 }

const hdAccount = () =>
    buildTestAccount(
        { kind: 'local', seed: 'bip39', hd: HD_INDEX },
        { [ETHEREUM]: { address: EVM_KEY_ADDRESS, keyPairId: 'hd-key' } },
        { id: 'hd' },
    )

const keyAccount = () =>
    buildTestAccount(
        TEST_CUSTODY.local,
        { [ETHEREUM]: { address: EVM_KEY_ADDRESS, keyPairId: EVM_KEY_ID } },
        { id: 'key' },
    )

const watchAccount = (address = EVM_KEY_ADDRESS, chainId: ChainId = ETHEREUM) =>
    buildTestAccount(
        TEST_CUSTODY.watch,
        { [chainId]: { address } },
        { id: `watch-${chainId}` },
    )

describe('enableChain', () => {
    let families: ChainFamilies
    const state = () => useAccountsStore.getState()

    beforeEach(() => {
        ledgerApps.clear()
        families = registerChainFamilies()
        getKeystoreStore().state.keys = [
            { id: 'hd-seed', type: 'seed', metadata: { scheme: 'bip39' } },
            {
                id: 'hd-key',
                type: 'secp256k1',
                metadata: { parentKeyId: 'hd-seed' },
            },
        ] as never
        vi.mocked(getProvider().key.store.remove).mockClear()
        state().resetState()
    })

    test('returns an account already enabled on the chain untouched, deriving nothing', async () => {
        const account = hdAccount()
        state().setAccounts([account])
        const setAccounts = vi.spyOn(state(), 'setAccounts')

        const result = await state().enableChain('hd', ETHEREUM, 'user')

        expect(result).toBe(state().accounts[0])
        expect(setAccounts).not.toHaveBeenCalled()
        expect(
            families.derivations.get(ETHEREUM)?.deriveAccount,
        ).not.toHaveBeenCalled()
    })

    test("derives an HD account's address at its own position from its seed and records who enabled it", async () => {
        state().setAccounts([hdAccount()])

        const result = await state().enableChain('hd', BASE, 'user')

        expect(
            families.derivations.get(BASE)?.deriveAccount,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                deriveFromSeed: expect.any(Function),
                getKey: expect.any(Function),
            }),
            'hd-seed',
            HD_INDEX.account,
            HD_INDEX.keyIndex,
            { scheme: 'secp256k1', networkId: 'mainnet' },
        )
        expect(result.chains[BASE]).toEqual({
            address: familyHdAddress('evm', 2, 1),
            keyPairId: familyHdKeyId('hd-seed', 'evm', 2, 1),
            enabledAt: expect.any(Number),
            enabledBy: 'user',
        })
        expect(state().accounts).toEqual([result])
    })

    test('reuses a standalone key on another chain of its family without importing it again', async () => {
        state().setAccounts([keyAccount()])

        const result = await state().enableChain('key', POLYGON, 'discovery')

        expect(result.chains[POLYGON]).toEqual({
            address: EVM_KEY_ADDRESS,
            keyPairId: EVM_KEY_ID,
            enabledAt: expect.any(Number),
            enabledBy: 'discovery',
        })
        expect(kmsCore.getKey).toHaveBeenCalledWith(EVM_KEY_ID)
        expect(
            families.derivations.get(POLYGON)?.importRawKey,
        ).not.toHaveBeenCalled()
    })

    test('carries a watched address to another chain in that chain’s canonical form', async () => {
        state().setAccounts([
            watchAccount(EVM_KEY_ADDRESS.toUpperCase().replace('0X', '0x')),
        ])

        const result = await state().enableChain('watch-ethereum', BASE, 'user')

        expect(result.chains[BASE]?.address).toBe(EVM_KEY_ADDRESS)
    })

    test("needs the device's address to enable a chain on a hardware account", async () => {
        ledgerApps.add(ETHEREUM)
        state().setAccounts([
            buildTestAccount(
                TEST_CUSTODY.hardware,
                { [ALGORAND]: { address: ALGORAND_ADDRESS } },
                { id: 'ledger' },
            ),
        ])

        await expect(
            state().enableChain('ledger', ETHEREUM, 'user'),
        ).rejects.toBeInstanceOf(DeviceAddressRequiredError)

        const result = await state().enableChain('ledger', ETHEREUM, 'user', {
            deviceAddress: EVM_KEY_ADDRESS,
        })
        expect(result.chains[ETHEREUM]).toMatchObject({
            address: EVM_KEY_ADDRESS,
            enabledBy: 'user',
        })
    })

    test("refuses, before writing anything, an address that isn't the one the caller holds", async () => {
        state().setAccounts([keyAccount()])

        await expect(
            state().enableChain('key', BASE, 'restore', {
                expectedAddress: `0x${'ab'.repeat(20)}`,
            }),
        ).rejects.toBeInstanceOf(AddressMismatchError)
        expect(state().accounts[0].chains[BASE]).toBeUndefined()
    })

    test('refuses a chain the custody cannot reach', async () => {
        state().setAccounts([watchAccount()])

        await expect(
            state().enableChain('watch-ethereum', ALGORAND, 'user'),
        ).rejects.toBeInstanceOf(ChainNotEligibleError)
        expect(state().accounts[0].chains[ALGORAND]).toBeUndefined()
    })

    test('refuses an address another account already holds on the chain, writing nothing', async () => {
        const other = watchAccount(EVM_KEY_ADDRESS, BASE)
        state().setAccounts([keyAccount(), other])

        await expect(
            state().enableChain('key', BASE, 'user'),
        ).rejects.toMatchObject({
            metadata: { params: { existingAccountId: other.id } },
        })
        expect(state().accounts[0].chains[BASE]).toBeUndefined()
        expect(getProvider().key.store.remove).not.toHaveBeenCalled()
    })

    test('writes nothing when the account is removed while its address is derived, and drops the derived key', async () => {
        state().setAccounts([hdAccount()])
        vi.mocked(
            families.derivations.get(ALGORAND)!.deriveAccount,
        ).mockImplementationOnce(async () => {
            state().setAccounts([])
            return { keyPairId: 'algo-key', address: ALGORAND_ADDRESS }
        })

        await expect(
            state().enableChain('hd', ALGORAND, 'user'),
        ).rejects.toBeInstanceOf(AccountNotFoundError)
        expect(state().accounts).toEqual([])
        expect(getProvider().key.store.remove).toHaveBeenCalledWith('algo-key')
    })

    test('throws for an unknown account', async () => {
        await expect(
            state().enableChain('missing', BASE, 'user'),
        ).rejects.toBeInstanceOf(AccountNotFoundError)
    })
})
