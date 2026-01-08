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

import { getAccountType } from '../utils'
import {
    HDWalletDetails,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

describe('webview/utils - getAccountType', () => {
    const baseAccount: WalletAccount = {
        type: 'hdWallet',
        address: 'ADDR1',
        canSign: true,
    }

    it('returns HdKey if hdWalletDetails is present', () => {
        expect(
            getAccountType({
                ...baseAccount,
                hdWalletDetails: {} as HDWalletDetails,
            }),
        ).toBe('HdKey')
    })

    it('returns LedgerBle if it is a ledger account', () => {
        expect(
            getAccountType({
                ...baseAccount,
                type: 'hardware',
                hardwareDetails: { manufacturer: 'ledger' },
            }),
        ).toBe('LedgerBle')
    })

    it('returns RekeyedAuth if it is rekeyed and can sign', () => {
        expect(
            getAccountType({
                ...baseAccount,
                rekeyAddress: 'ADDR2',
                canSign: true,
            }),
        ).toBe('RekeyedAuth')
    })

    it('returns Rekeyed if it is rekeyed but cannot sign', () => {
        expect(
            getAccountType({
                ...baseAccount,
                rekeyAddress: 'ADDR2',
                canSign: false,
            }),
        ).toBe('Rekeyed')
    })

    it('returns Algo25 for standard accounts without HD details', () => {
        expect(getAccountType({
            ...baseAccount,
            type: 'algo25'
        })).toBe('Algo25')
    })

    it('returns NoAuth for watch accounts', () => {
        expect(
            getAccountType({
                ...baseAccount,
                type: 'watch',
            }),
        ).toBe('NoAuth')
    })

    it('returns Multisig for multisig accounts', () => {
        expect(
            getAccountType({
                ...baseAccount,
                type: 'multisig',
            }),
        ).toBe('Multisig')
    })

    it('returns Unknown for unknown combinations', () => {
        // This is tricky because the utility covers most cases,
        // but if we pass something that doesn't match any branch:
        expect(
            getAccountType({
                ...baseAccount,
                type: 'hardware',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                hardwareDetails: { manufacturer: 'other' as any },
            }),
        ).toBe('Unknown')
    })
})
