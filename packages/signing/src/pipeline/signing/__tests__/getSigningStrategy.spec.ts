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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import '../../../__tests__/registerAlgorandAccounts'
import {
    chainAccountOf,
    type AccountCustody,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({
    isHardwareWalletAccount: vi.fn(),
    resolveAuthAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        isHardwareWalletAccount: mocks.isHardwareWalletAccount,
        resolveAuthAccount: mocks.resolveAuthAccount,
    }
})

import { createSigningStrategySelector } from '../getSigningStrategy'
import { CannotSignError } from '../../errors'
import type { SigningResult, SigningStrategy } from '../../types'
import { registerFakeLocalKeySignerAdapter } from '../../../__tests__/fakeLocalKeySignerAdapter'
import { registerFakePlannerAdapter } from '../../../__tests__/fakePlannerAdapter'
import {
    TEST_CHAIN_ID,
    algo25Account,
    ledgerAccount,
    multisigAccount,
    testAccount,
    watchAccount,
} from '../../../__tests__/accounts'

const addressOf = (account: WalletAccount) =>
    chainAccountOf(account, TEST_CHAIN_ID)?.address

const algo25 = algo25Account('A', { keyPairId: 'key-a' })

const hardwareAccount = ledgerAccount('H')

const multisig = multisigAccount('M')

const weirdAccount = testAccount(
    { kind: 'weird' } as unknown as AccountCustody,
    'W',
)

let localStrategy: SigningStrategy
let multisigStrategy: SigningStrategy

const emptyResult = (address: string): SigningResult => ({
    signedData: { type: 'transactions', signed: [] },
    signers: [{ address }],
})

const makeSelector = () =>
    createSigningStrategySelector({
        scope: { chainId: 'algorand', networkId: 'mainnet' },
        signTransactions: vi.fn(),
        signArbitraryData: vi.fn(),
        signAuthData: vi.fn(),
        getLocalParticipants: vi.fn(() => []),
        getAllAccounts: vi.fn(() => []),
        encodeTransaction: vi.fn(),
    })

beforeEach(() => {
    // Stand-ins for the chain package's strategies: the local one signs through
    // the injected function, the multisig one fans out to each participant's
    // strategy, which is the part the selector's rekey rules govern.
    registerFakeLocalKeySignerAdapter({
        createStrategy: vi.fn(options => {
            localStrategy = {
                canSign: () => true,
                sign: async (_group, account) => {
                    await options.signTransactions([], [], account)
                    return emptyResult(addressOf(account) ?? '')
                },
            }
            return localStrategy
        }),
    })
    registerFakePlannerAdapter({
        createMultisigStrategy: vi.fn(options => {
            multisigStrategy = {
                canSign: () => true,
                sign: async (group, account, callbacks) => {
                    const participants = options.getLocalParticipants(
                        account,
                        options.getAllAccounts(),
                    )
                    const results = await Promise.all(
                        participants.map(participant =>
                            options
                                .getStrategyForParticipant(participant)
                                .sign(group, participant, callbacks),
                        ),
                    )
                    return results[0]
                },
            }
            return multisigStrategy
        }),
    })
    mocks.isHardwareWalletAccount.mockReset().mockReturnValue(false)
    mocks.resolveAuthAccount.mockReset()
})

describe('createSigningStrategySelector', () => {
    test('returns multisig strategy for multisig accounts', () => {
        mocks.resolveAuthAccount.mockImplementation(a => a)
        const select = makeSelector()
        const strategy = select(multisig, [multisig])
        expect(strategy).toBe(multisigStrategy)
    })

    test('returns multisig strategy when the auth account is multisig (rekeyed-to-msig sender)', () => {
        mocks.resolveAuthAccount.mockReturnValue(multisig)
        const select = makeSelector()
        const strategy = select(algo25, [algo25, multisig])
        expect(strategy).toBe(multisigStrategy)
    })

    test('returns hardware strategy when auth account is hardware', () => {
        mocks.resolveAuthAccount.mockReturnValue(hardwareAccount)
        mocks.isHardwareWalletAccount.mockImplementation(
            a => a.custody.kind === 'hardware',
        )
        const select = makeSelector()
        const strategy = select(hardwareAccount, [hardwareAccount])
        expect(strategy).not.toBe(localStrategy)
        expect(strategy).not.toBe(multisigStrategy)
        expect(strategy.canSign(hardwareAccount)).toBe(true)
    })

    test('returns local strategy when auth account has signing keys', () => {
        mocks.resolveAuthAccount.mockReturnValue(algo25)
        const select = makeSelector()
        const strategy = select(algo25, [algo25])
        expect(strategy).toBe(localStrategy)
    })

    test('throws CannotSignError when no signing capability', () => {
        mocks.resolveAuthAccount.mockReturnValue(weirdAccount)
        mocks.isHardwareWalletAccount.mockReturnValue(false)

        const select = makeSelector()
        expect(() => select(weirdAccount, [weirdAccount])).toThrow(
            CannotSignError,
        )
    })

    describe('multisig participant strategy (rekey MUST be bypassed)', () => {
        // The multisig participant slot on chain is bound to the participant's
        // ORIGINAL pubkey at multisig creation, so the participant signs with
        // its own keys regardless of any rekey indirection. The selector
        // returned to multisigStrategy.getStrategyForParticipant must therefore
        // NOT consult resolveAuthAccount for participants.
        const buildSign = (
            participants: WalletAccount[],
            signTransactions = vi.fn().mockResolvedValue([]),
        ) => {
            mocks.isHardwareWalletAccount.mockImplementation(
                a => a.custody.kind === 'hardware',
            )
            // Configure resolveAuthAccount to return a DIFFERENT-typed
            // account if it is consulted — so any unintended call would
            // pick the wrong strategy and fail the assertion.
            mocks.resolveAuthAccount.mockImplementation(
                (account: WalletAccount) => {
                    if (account.custody.kind === 'local') {
                        return ledgerAccount(`${addressOf(account)}_AUTH`)
                    }
                    if (account.custody.kind === 'hardware') {
                        return algo25Account(`${addressOf(account)}_AUTH`)
                    }
                    return account
                },
            )

            const select = createSigningStrategySelector({
                scope: { chainId: 'algorand', networkId: 'mainnet' },
                signTransactions,
                signArbitraryData: vi.fn(),
                signAuthData: vi.fn(),
                getLocalParticipants: vi.fn(() => participants),
                getAllAccounts: vi.fn(() => participants),
                encodeTransaction: vi.fn(),
            })
            return { select, signTransactions }
        }

        const fakeGroup = {
            data: { type: 'transactions', transactions: [], indicesToSign: [] },
            source: { type: 'multisig-cosign', signRequestId: 'sr-1' },
            signerAddress: 'M',
            analysis: {
                totalFees: 0n,
                transactionSummaries: [],
                warnings: [],
                signableAddresses: [],
                riskLevel: 'low',
            },
        } as never

        test('picks the local strategy for a local-key participant even when its rekey target is hardware', async () => {
            const participant = algo25
            const { select, signTransactions } = buildSign([participant])

            const strategy = select(multisig, [participant])
            await strategy.sign(fakeGroup, multisig)

            // The participant's local-key signing function must be invoked,
            // proving the local strategy was picked (NOT the hardware
            // strategy that the participant's rekey target would select).
            expect(signTransactions).toHaveBeenCalledTimes(1)
            // resolveAuthAccount must NOT have been consulted for the
            // participant address — multisig slots ignore rekey.
            for (const call of mocks.resolveAuthAccount.mock.calls) {
                expect(addressOf(call[0] as WalletAccount)).not.toBe(
                    addressOf(participant),
                )
            }
        })

        test('throws CannotSignError when participant has no own signing capability (rekey is not consulted as a fallback)', async () => {
            const orphan = watchAccount('WATCH')
            const { select } = buildSign([orphan])

            const strategy = select(multisig, [orphan])

            await expect(strategy.sign(fakeGroup, multisig)).rejects.toThrow(
                CannotSignError,
            )
            for (const call of mocks.resolveAuthAccount.mock.calls) {
                expect(addressOf(call[0] as WalletAccount)).not.toBe('WATCH')
            }
        })
    })
})
