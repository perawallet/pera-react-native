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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    accountChainOptions,
    canSignWith,
    isMultisigAccount,
    type AccountChainOption,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    canSwapCrossChain,
    swapPayoutAddressOn,
} from '../crossChainEligibility'

const account = (chains: WalletAccount['chains']): WalletAccount => ({
    id: 'a',
    name: '',
    custody: { kind: 'local', seed: null },
    chains,
})

const offering = (...options: AccountChainOption[]) =>
    vi.mocked(accountChainOptions).mockReturnValue(options)

describe('swapPayoutAddressOn', () => {
    beforeEach(() => {
        vi.mocked(canSignWith).mockReturnValue(true)
    })

    it('pays an enabled chain at its own address when a signer holds it', () => {
        offering({ chainId: 'ethereum', isEnabled: true, address: '0x1' })

        expect(swapPayoutAddressOn(account({}), [], 'ethereum')).toBe('0x1')
    })

    it('pays a chain not enabled yet at the family address, without asking for a signer', () => {
        offering({ chainId: 'base', isEnabled: false, address: '0x1' })
        vi.mocked(canSignWith).mockReturnValue(false)

        expect(swapPayoutAddressOn(account({}), [], 'base')).toBe('0x1')
    })

    it('has no address for a chain the account holds no family on', () => {
        offering({ chainId: 'base', isEnabled: false })

        expect(swapPayoutAddressOn(account({}), [], 'base')).toBeUndefined()
    })

    it('has no address for a chain the account cannot be offered', () => {
        offering()

        expect(swapPayoutAddressOn(account({}), [], 'base')).toBeUndefined()
    })

    it('has no address for an enabled chain nothing signs for', () => {
        offering({ chainId: 'ethereum', isEnabled: true, address: '0x1' })
        vi.mocked(canSignWith).mockReturnValue(false)

        expect(swapPayoutAddressOn(account({}), [], 'ethereum')).toBeUndefined()
    })
})

describe('canSwapCrossChain', () => {
    it('keeps a shared account on its own chain', () => {
        vi.mocked(isMultisigAccount).mockReturnValue(true)

        expect(canSwapCrossChain(account({}))).toBe(false)
    })
})
