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
    describe,
    it,
    expect,
    vi,
    afterEach,
    beforeAll,
    beforeEach,
} from 'vitest'
import {
    registerAlgorandRulesAs,
    seedAuthority,
} from '../../../../__tests__/registerAlgorandAccounts'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import {
    SECOND_CHAIN_SCOPE,
    fakeTransactionPlanner,
    makeUnsignedTransaction,
    planFromPayload,
    registerFakeTransactionPlanner,
} from '../../../../__tests__/transactions'
import { SIGNING_KEY_DOMAIN } from '../../../../constants'
import {
    CannotSignError,
    InvalidSignableDataError,
    SigningError,
} from '../../../../pipeline/errors'
import type { AnalyzedSignableGroup } from '../../../../pipeline/types'
import { signPlannedGroups } from '../signPlannedGroups'

const OURS = '0xOURS'
const AUTH = '0xAUTH'

const localAccount = (
    address = OURS,
    keyPairId = 'eth-key',
    overrides: object = {},
): WalletAccount =>
    ({
        custody: { kind: 'local', seed: null },
        address: `${address}-algorand`,
        chains: { ethereum: { address, keyPairId } },
        ...overrides,
    }) as unknown as WalletAccount

const neutralGroup = (
    transactions = [makeUnsignedTransaction(OURS)],
    reviewed: string[] = [OURS, AUTH],
): AnalyzedSignableGroup =>
    ({
        data: { type: 'transactions', transactions, chainData: {} },
        source: { type: 'local' },
        signerAddress: OURS,
        originalIndices: transactions.map((_, i) => i),
        analysis: { signableAddresses: reviewed },
    }) as unknown as AnalyzedSignableGroup

const flipped = (bytes: Uint8Array): Uint8Array => bytes.map(b => b ^ 0xff)

describe('signPlannedGroups', () => {
    const sign = vi.fn(async (_keyPairId: string, payload: Uint8Array) =>
        flipped(payload),
    )

    const run = (
        groups: AnalyzedSignableGroup[],
        accounts: WalletAccount[] = [localAccount()],
    ) =>
        signPlannedGroups({
            groups,
            allAccounts: accounts,
            scope: SECOND_CHAIN_SCOPE,
            keyStore: { sign },
        })

    const planning = (plan: Parameters<typeof fakeTransactionPlanner>[0]) =>
        registerFakeTransactionPlanner(fakeTransactionPlanner(plan))

    beforeAll(() => registerAlgorandRulesAs(SECOND_CHAIN_SCOPE.chainId))

    beforeEach(() => {
        sign.mockClear()
        registerFakeTransactionPlanner()
    })

    afterEach(() => seedAuthority(OURS, null, SECOND_CHAIN_SCOPE))

    it("signs exactly the planned bytes with the reviewed account's key, then assembles them", async () => {
        const transactions = [
            makeUnsignedTransaction(OURS),
            makeUnsignedTransaction(OURS),
        ]
        const planned = planFromPayload(transactions[0])[0].payload

        const [result] = await run([neutralGroup(transactions)])

        expect(sign.mock.calls).toEqual([
            ['eth-key', planned, SIGNING_KEY_DOMAIN],
            ['eth-key', planned, SIGNING_KEY_DOMAIN],
        ])
        expect(result).toEqual({
            signedData: {
                type: 'signed-transactions',
                signed: transactions.map(transaction => ({
                    scope: transaction.scope,
                    id: `signed-by-${OURS}`,
                    bytes: flipped(planned),
                })),
            },
            signers: [{ address: OURS }],
            originalIndices: [0, 1],
        })
    })

    it('signs every request a transaction plans for the reviewed account', async () => {
        planning(transaction => [
            ...planFromPayload(transaction),
            { ...planFromPayload(transaction)[0], requestIndex: 1 },
        ])

        const [result] = await run([neutralGroup()])

        expect(sign).toHaveBeenCalledTimes(2)
        expect(result.signedData).toMatchObject({
            signed: [{ id: `signed-by-${OURS},${OURS}` }],
        })
    })

    it('signs each held key a transaction plans, leaving the others to their holders', async () => {
        planning(transaction => [
            ...planFromPayload(transaction),
            {
                ...planFromPayload(transaction)[0],
                requestIndex: 1,
                signer: AUTH,
            },
            {
                ...planFromPayload(transaction)[0],
                requestIndex: 2,
                signer: '0xSOMEONE_ELSE',
            },
        ])

        const [result] = await run(
            [neutralGroup()],
            [localAccount(), localAccount(AUTH, 'auth-key')],
        )

        expect(sign.mock.calls.map(([keyPairId]) => keyPairId)).toEqual([
            'eth-key',
            'auth-key',
        ])
        expect(result.signedData).toMatchObject({
            signed: [{ id: `signed-by-${OURS},${AUTH}` }],
        })
    })

    it("never signs with a held key the review didn't list", async () => {
        planning(transaction => [
            ...planFromPayload(transaction),
            {
                ...planFromPayload(transaction)[0],
                requestIndex: 1,
                signer: AUTH,
            },
        ])

        await run(
            [neutralGroup(undefined, [OURS])],
            [localAccount(), localAccount(AUTH, 'auth-key')],
        )

        expect(sign.mock.calls.map(([keyPairId]) => keyPairId)).toEqual([
            'eth-key',
        ])
    })

    it('leaves a participant whose key is not on this device to its holder', async () => {
        planning(transaction => [
            ...planFromPayload(transaction),
            {
                ...planFromPayload(transaction)[0],
                requestIndex: 1,
                signer: AUTH,
            },
        ])
        const watched = localAccount(AUTH, 'auth-key', {
            custody: { kind: 'watch' },
        })

        await run([neutralGroup()], [localAccount(), watched])

        expect(sign.mock.calls.map(([keyPairId]) => keyPairId)).toEqual([
            'eth-key',
        ])
    })

    it('refuses a transaction none of whose keys the wallet holds, signing nothing', async () => {
        planning(transaction => [
            { ...planFromPayload(transaction)[0], signer: '0xSOMEONE_ELSE' },
        ])

        await expect(run([neutralGroup()])).rejects.toBeInstanceOf(
            CannotSignError,
        )
        expect(sign).not.toHaveBeenCalled()
    })

    it('signs with the key the planner names, never following a rekey again', async () => {
        seedAuthority(OURS, AUTH, SECOND_CHAIN_SCOPE)
        const auth = localAccount(AUTH, 'auth-key', {
            chains: {
                ethereum: { address: AUTH, keyPairId: 'auth-key' },
                algorand: { address: AUTH },
            },
        })

        await run([neutralGroup()], [localAccount(), auth])

        expect(sign.mock.calls.map(([keyPairId]) => keyPairId)).toEqual([
            'eth-key',
        ])
    })

    it.each([
        ['hardware', { kind: 'hardware', device: {}, accountIndex: 0 }],
        ['watch', { kind: 'watch' }],
    ])(
        'refuses a %s account, whose key is not on this device',
        async (_kind, custody) => {
            await expect(
                run(
                    [neutralGroup()],
                    [localAccount(OURS, 'eth-key', { custody })],
                ),
            ).rejects.toBeInstanceOf(CannotSignError)
            expect(sign).not.toHaveBeenCalled()
        },
    )

    it("refuses a request in a scheme the account's key doesn't use", async () => {
        planning(transaction => [
            { ...planFromPayload(transaction)[0], scheme: 'secp256k1' },
        ])

        await expect(run([neutralGroup()])).rejects.toBeInstanceOf(
            CannotSignError,
        )
        expect(sign).not.toHaveBeenCalled()
    })

    it("refuses a group whose signer the wallet doesn't hold on this chain", async () => {
        await expect(
            run([neutralGroup()], [localAccount('0xSOMEONE_ELSE')]),
        ).rejects.toBeInstanceOf(CannotSignError)
        expect(sign).not.toHaveBeenCalled()
    })

    it('refuses an account with an address but no key on this chain', async () => {
        await expect(
            run(
                [neutralGroup()],
                [
                    localAccount(OURS, 'eth-key', {
                        chains: { ethereum: { address: OURS } },
                    }),
                ],
            ),
        ).rejects.toBeInstanceOf(CannotSignError)
        expect(sign).not.toHaveBeenCalled()
    })

    it("refuses a payload the planner can't read at signing time, as untrusted data", async () => {
        planning(() => {
            throw new Error('The payload is malformed')
        })

        await expect(run([neutralGroup()])).rejects.toBeInstanceOf(
            InvalidSignableDataError,
        )
        expect(sign).not.toHaveBeenCalled()
    })

    it("fails for good when the planner won't assemble the signatures", async () => {
        registerFakeTransactionPlanner({
            ...fakeTransactionPlanner(),
            assemble: () => {
                throw new Error('wrong signatures')
            },
        })

        const error = await run([neutralGroup()]).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(SigningError)
        expect(error).toMatchObject({
            metadata: expect.objectContaining({ retryable: false }),
        })
    })

    it('signs nothing but chain-neutral transactions', async () => {
        const algorandGroup = {
            ...neutralGroup(),
            data: { type: 'transactions', transactions: [], indicesToSign: [] },
        } as unknown as AnalyzedSignableGroup

        await expect(run([algorandGroup])).rejects.toBeInstanceOf(
            InvalidSignableDataError,
        )
        expect(sign).not.toHaveBeenCalled()
    })

    it('refuses a chain with no transaction planner', async () => {
        await expect(
            signPlannedGroups({
                groups: [neutralGroup()],
                allAccounts: [localAccount()],
                scope: { chainId: 'algorand', networkId: 'mainnet' },
                keyStore: { sign },
            }),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
    })
})
