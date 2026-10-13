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

import { describe, it, expect } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    CardAccountAddressMissingError,
    cardAccountAddressOf,
    findCardAccount,
    requireCardAccountAddress,
} from '../cardAccountAddress'

const CARD_CHAIN = 'algorand' as ChainId
const OTHER_CHAIN = 'ethereum' as ChainId

const account = (
    id: string,
    chains: WalletAccount['chains'],
): WalletAccount => ({
    id,
    custody: { kind: 'watch' },
    chains,
})

const onCardChain = account('card', { algorand: { address: 'CARD_ADDR' } })
const elsewhere = account('elsewhere', { ethereum: { address: '0xabc' } })

describe('cardAccountAddressOf', () => {
    it("reads the account's address on the card chain", () => {
        expect(cardAccountAddressOf(onCardChain, CARD_CHAIN)).toBe('CARD_ADDR')
    })

    it('is undefined when the account has nothing on that chain', () => {
        expect(cardAccountAddressOf(elsewhere, CARD_CHAIN)).toBeUndefined()
    })
})

describe('requireCardAccountAddress', () => {
    it('returns the address on the card chain', () => {
        expect(requireCardAccountAddress(onCardChain, CARD_CHAIN)).toBe(
            'CARD_ADDR',
        )
    })

    it('refuses an account with no address on the card chain', () => {
        expect(() =>
            requireCardAccountAddress(onCardChain, OTHER_CHAIN),
        ).toThrow(CardAccountAddressMissingError)
    })
})

describe('findCardAccount', () => {
    const accounts = [elsewhere, onCardChain]

    it('finds the account holding the address on the card chain', () => {
        expect(findCardAccount(accounts, 'CARD_ADDR', CARD_CHAIN)).toBe(
            onCardChain,
        )
    })

    it('ignores the same address on another chain', () => {
        expect(findCardAccount(accounts, '0xabc', CARD_CHAIN)).toBeUndefined()
    })

    it('finds nothing for no stored address', () => {
        expect(findCardAccount(accounts, null, CARD_CHAIN)).toBeUndefined()
        expect(findCardAccount(accounts, '', CARD_CHAIN)).toBeUndefined()
    })
})
