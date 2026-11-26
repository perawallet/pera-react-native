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

import { describe, expect, it } from 'vitest'
import {
    accountKindId,
    type AccountKindId,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { createEvmAccountPresentation } from '../presentation'
import { ethereumKindIdOf } from '../local-key-kinds'
import { ETHEREUM } from '../../__tests__/evm-chains'

const ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const chains = { ethereum: { address: ADDRESS } }

const ACCOUNTS: Record<string, WalletAccount> = {
    privateKey: {
        id: 'pk',
        name: '',
        chains,
        custody: { kind: 'local', seed: null },
    },
    hd: {
        id: 'hd',
        name: '',
        chains,
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
    },
    watch: { id: 'watch', name: '', chains, custody: { kind: 'watch' } },
    ledger: {
        id: 'ledger',
        name: '',
        chains,
        custody: {
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'device',
                deviceName: 'Ledger Nano X',
                transportType: 'ble',
            },
            accountIndex: 0,
        },
    },
}

describe('createEvmAccountPresentation', () => {
    const presentation = createEvmAccountPresentation(ETHEREUM)
    const describeAccount = (account: WalletAccount, canSign = true) =>
        presentation.describe(ethereumKindIdOf(account), { canSign })

    it('serves the chain it was built for', () => {
        expect(presentation.chainId).toBe(ETHEREUM.descriptor.id)
    })

    it.each([
        ['privateKey', 'account_info.type_private_key'],
        ['hd', 'account_info.type_universal_wallet'],
        ['ledger', 'account_info.type_ledger'],
        ['watch', 'account_info.type_watch'],
    ])('labels a %s account %s', (name, labelKey) => {
        expect(describeAccount(ACCOUNTS[name])?.labelKey).toBe(labelKey)
    })

    it('uses no Algorand-only copy, article or rekey wording for any kind', () => {
        for (const account of Object.values(ACCOUNTS)) {
            const described = describeAccount(account)
            const keys = [
                described?.labelKey,
                described?.infoTitleKey,
                described?.infoBodyKey,
            ]

            expect(described?.supportUrl).toBeUndefined()
            for (const key of keys) {
                expect(key).toBeDefined()
                expect(key).not.toMatch(/type_algo25|standard_|no_auth|rekey/)
            }
        }
    })

    it('words a watch account the same whether or not it can sign', () => {
        expect(describeAccount(ACCOUNTS.watch, false)).toEqual(
            describeAccount(ACCOUNTS.watch, true),
        )
    })

    it.each<AccountKindId>([
        accountKindId('multisig'),
        accountKindId('quantum'),
        accountKindId('not-a-kind'),
    ])('describes no %s kind', kindId => {
        expect(presentation.describe(kindId, { canSign: true })).toBeUndefined()
    })

    it('words an authority transition for no kind, since EVM has no authority', () => {
        expect(presentation.transitionLabel).toBeUndefined()
    })
})
