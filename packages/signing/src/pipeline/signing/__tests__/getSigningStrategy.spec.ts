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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({
    isMultisigAccount: vi.fn(),
    isHardwareWalletAccount: vi.fn(),
    hasSigningKeys: vi.fn(),
    resolveAuthAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        isMultisigAccount: mocks.isMultisigAccount,
        isHardwareWalletAccount: mocks.isHardwareWalletAccount,
        hasSigningKeys: mocks.hasSigningKeys,
        resolveAuthAccount: mocks.resolveAuthAccount,
    }
})

import { createSigningStrategySelector } from '../getSigningStrategy'
import { CannotSignError } from '../../errors'

const algo25Account = {
    type: 'algo25',
    address: 'A',
} as unknown as WalletAccount

const hardwareAccount = {
    type: 'hardware',
    address: 'H',
} as unknown as WalletAccount

const multisigAccount = {
    type: 'multisig',
    address: 'M',
} as unknown as WalletAccount

const weirdAccount = {
    type: 'weird',
    address: 'W',
} as unknown as WalletAccount

const makeSelector = () =>
    createSigningStrategySelector({
        signTransactions: vi.fn(),
        signArbitraryData: vi.fn(),
        signArc60: vi.fn(),
        getLocalParticipants: vi.fn(() => []),
        getAllAccounts: vi.fn(() => []),
        encodeTransaction: vi.fn(),
    })

beforeEach(() => {
    mocks.isMultisigAccount.mockReset().mockReturnValue(false)
    mocks.isHardwareWalletAccount.mockReset().mockReturnValue(false)
    mocks.hasSigningKeys.mockReset().mockReturnValue(false)
    mocks.resolveAuthAccount.mockReset()
})

describe('createSigningStrategySelector', () => {
    test('returns multisig strategy for multisig accounts', () => {
        mocks.isMultisigAccount.mockImplementation(a => a.type === 'multisig')
        mocks.resolveAuthAccount.mockImplementation(a => a)
        const select = makeSelector()
        const strategy = select(multisigAccount, [multisigAccount])
        expect(strategy.canSign(multisigAccount)).toBe(true)
    })

    test('returns multisig strategy when the auth account is multisig (rekeyed-to-msig sender)', () => {
        mocks.isMultisigAccount.mockImplementation(a => a.type === 'multisig')
        mocks.resolveAuthAccount.mockReturnValue(multisigAccount)
        const select = makeSelector()
        const strategy = select(algo25Account, [algo25Account, multisigAccount])
        expect(strategy.canSign(multisigAccount)).toBe(true)
    })

    test('returns hardware strategy when auth account is hardware', () => {
        mocks.resolveAuthAccount.mockReturnValue(hardwareAccount)
        mocks.isHardwareWalletAccount.mockImplementation(
            a => a.type === 'hardware',
        )
        const select = makeSelector()
        const strategy = select(hardwareAccount, [hardwareAccount])
        expect(strategy.canSign(hardwareAccount)).toBe(true)
    })

    test('returns local strategy when auth account has signing keys', () => {
        mocks.resolveAuthAccount.mockReturnValue(algo25Account)
        mocks.hasSigningKeys.mockImplementation(a => a.type === 'algo25')
        const select = makeSelector()
        const strategy = select(algo25Account, [algo25Account])
        expect(strategy.canSign(algo25Account)).toBe(true)
    })

    test('throws CannotSignError when no signing capability', () => {
        mocks.resolveAuthAccount.mockReturnValue(weirdAccount)
        mocks.hasSigningKeys.mockReturnValue(false)
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
            mocks.isMultisigAccount.mockImplementation(
                a => a.type === 'multisig',
            )
            mocks.isHardwareWalletAccount.mockImplementation(
                a => a.type === 'hardware',
            )
            mocks.hasSigningKeys.mockImplementation(a => a.type === 'algo25')
            // Configure resolveAuthAccount to return a DIFFERENT-typed
            // account if it is consulted — so any unintended call would
            // pick the wrong strategy and fail the assertion.
            mocks.resolveAuthAccount.mockImplementation(
                (account: WalletAccount) => {
                    if (account.type === 'algo25') {
                        return {
                            type: 'hardware',
                            address: `${account.address}_AUTH`,
                        } as unknown as WalletAccount
                    }
                    if (account.type === 'hardware') {
                        return {
                            type: 'algo25',
                            address: `${account.address}_AUTH`,
                        } as unknown as WalletAccount
                    }
                    return account
                },
            )

            const select = createSigningStrategySelector({
                signTransactions,
                signArbitraryData: vi.fn(),
                signArc60: vi.fn(),
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
            const participant = algo25Account
            const { select, signTransactions } = buildSign([participant])

            const strategy = select(multisigAccount, [participant])
            await strategy.sign(fakeGroup, multisigAccount)

            // The participant's local-key signing function must be invoked,
            // proving the local strategy was picked (NOT the hardware
            // strategy that the participant's rekey target would select).
            expect(signTransactions).toHaveBeenCalledTimes(1)
            // resolveAuthAccount must NOT have been consulted for the
            // participant address — multisig slots ignore rekey.
            for (const call of mocks.resolveAuthAccount.mock.calls) {
                expect((call[0] as WalletAccount).address).not.toBe(
                    participant.address,
                )
            }
        })

        test('throws CannotSignError when participant has no own signing capability (rekey is not consulted as a fallback)', async () => {
            const orphan = {
                type: 'watch',
                address: 'WATCH',
            } as unknown as WalletAccount
            const { select } = buildSign([orphan])

            const strategy = select(multisigAccount, [orphan])

            await expect(
                strategy.sign(fakeGroup, multisigAccount),
            ).rejects.toThrow(CannotSignError)
            for (const call of mocks.resolveAuthAccount.mock.calls) {
                expect((call[0] as WalletAccount).address).not.toBe('WATCH')
            }
        })
    })
})
