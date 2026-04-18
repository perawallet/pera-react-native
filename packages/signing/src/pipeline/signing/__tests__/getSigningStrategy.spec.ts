/*
 Copyright 2022-2025 Pera Wallet, LDA
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
        const select = makeSelector()
        const strategy = select(multisigAccount, [multisigAccount])
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
})
