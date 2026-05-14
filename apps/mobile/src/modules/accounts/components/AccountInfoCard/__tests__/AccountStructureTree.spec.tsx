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

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@test-utils/render'
import { AccountStructureTree } from '../AccountStructureTree'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountLogicalType: () => null,
    isMultisigAccount: (account: { type?: string }) =>
        account?.type === 'multisig',
    AccountTypes: {
        algo25: 'algo25',
        hdWallet: 'hdWallet',
        hardware: 'hardware',
        multisig: 'multisig',
        watch: 'watch',
    },
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children }: any) => <div>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: ({ children }: any) => <span>{children}</span>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWTouchableOpacity: ({ children, onPress }: any) => (
        <button onClick={onPress}>{children}</button>
    ),
    PWIcon: () => null,
    PWRoundIcon: () => null,
}))

vi.mock('@components/CopyableText', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CopyableText: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('../AccountIcon', () => ({
    AccountIcon: () => <span />,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    truncateAlgorandAddress: (addr: string) => addr,
}))

const mainAccount: WalletAccount = {
    type: 'hardware',
    address: 'LEDGER_MAIN_ADDR',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-abc',
        deviceName: 'My Ledger',
        accountIndex: 0,
        transportType: 'ble',
    },
}

const subAccountOne: WalletAccount = {
    type: 'hardware',
    address: 'LEDGER_SUB_ADDR_1',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-abc',
        deviceName: 'My Ledger',
        accountIndex: 1,
        transportType: 'ble',
    },
}

const subAccountTwo: WalletAccount = {
    type: 'hardware',
    address: 'LEDGER_SUB_ADDR_2',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-abc',
        deviceName: 'My Ledger',
        accountIndex: 2,
        transportType: 'ble',
    },
}

describe('AccountStructureTree', () => {
    it('labels the account matching mainAccountAddress as Main Address and others as Sub Address', () => {
        render(
            <AccountStructureTree
                label='My Ledger'
                icon='ledger'
                accounts={[mainAccount, subAccountOne, subAccountTwo]}
                mainAccountAddress={mainAccount.address}
                onScanAddresses={vi.fn()}
            />,
        )

        expect(screen.getAllByText('account_info.main_address')).toHaveLength(1)
        expect(screen.getAllByText('account_info.sub_address')).toHaveLength(2)
    })

    it('prefers user-set account.name over the main/sub fallback', () => {
        const namedMain: WalletAccount = { ...mainAccount, name: 'My Savings' }
        const namedSub: WalletAccount = { ...subAccountOne, name: 'Spending' }

        render(
            <AccountStructureTree
                label='My Ledger'
                icon='ledger'
                accounts={[namedMain, namedSub, subAccountTwo]}
                mainAccountAddress={namedMain.address}
                onScanAddresses={vi.fn()}
            />,
        )

        expect(screen.getByText('My Savings')).toBeTruthy()
        expect(screen.getByText('Spending')).toBeTruthy()
        expect(screen.queryByText('account_info.main_address')).toBeNull()
        expect(screen.getAllByText('account_info.sub_address')).toHaveLength(1)
    })

    it('labels every account as Sub Address when no account matches mainAccountAddress', () => {
        render(
            <AccountStructureTree
                label='My Ledger'
                icon='ledger'
                accounts={[subAccountOne, subAccountTwo]}
                mainAccountAddress=''
                onScanAddresses={vi.fn()}
            />,
        )

        expect(screen.queryByText('account_info.main_address')).toBeNull()
        expect(screen.getAllByText('account_info.sub_address')).toHaveLength(2)
    })
})
