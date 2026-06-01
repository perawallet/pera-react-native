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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { isMultisigUnsignable } from '@perawallet/wallet-core-accounts'
import type { SignRequest } from '../../models'
import { isSignRequestMultisigUnsignable } from '../isSignRequestMultisigUnsignable'

// Only the account-capability predicate is mocked; the request-type guard and
// signer resolution use their real implementations against the fixtures below.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    isMultisigUnsignable: vi.fn(() => false),
}))

const SIGNER = 'MS_ADDR'

const txRequest = (overrides: object = {}): SignRequest =>
    ({
        id: 'r1',
        type: 'transactions',
        txs: [{ sender: SIGNER }],
        ...overrides,
    }) as unknown as SignRequest

const accounts = [{ address: SIGNER }] as unknown as WalletAccount[]

describe('isSignRequestMultisigUnsignable', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(isMultisigUnsignable).mockReturnValue(false)
    })

    it('returns the account predicate result for a transaction request', () => {
        vi.mocked(isMultisigUnsignable).mockReturnValue(true)

        expect(isSignRequestMultisigUnsignable(txRequest(), accounts)).toBe(
            true,
        )
        expect(isMultisigUnsignable).toHaveBeenCalledWith(accounts[0], accounts)
    })

    it('returns false when the account is signable', () => {
        vi.mocked(isMultisigUnsignable).mockReturnValue(false)

        expect(isSignRequestMultisigUnsignable(txRequest(), accounts)).toBe(
            false,
        )
    })

    it('excludes multisig-cosign requests (they pin a signable participant)', () => {
        vi.mocked(isMultisigUnsignable).mockReturnValue(true)

        expect(
            isSignRequestMultisigUnsignable(
                txRequest({ sourceType: 'multisig-cosign' }),
                accounts,
            ),
        ).toBe(false)
        expect(isMultisigUnsignable).not.toHaveBeenCalled()
    })

    it('returns false for a non-transaction request', () => {
        vi.mocked(isMultisigUnsignable).mockReturnValue(true)

        const arbitraryDataRequest = {
            id: 'r1',
            type: 'arbitrary-data',
            data: [{ signer: SIGNER }],
        } as unknown as SignRequest

        expect(
            isSignRequestMultisigUnsignable(arbitraryDataRequest, accounts),
        ).toBe(false)
    })

    it('returns false when the request has no resolvable signer', () => {
        expect(
            isSignRequestMultisigUnsignable(txRequest({ txs: [{}] }), accounts),
        ).toBe(false)
    })

    it('returns false when the signer is not a held account', () => {
        vi.mocked(isMultisigUnsignable).mockReturnValue(true)

        expect(isSignRequestMultisigUnsignable(txRequest(), [])).toBe(false)
    })
})
