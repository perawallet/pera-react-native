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

import { IconName, PWIcon } from '@components/core'

import { useMemo } from 'react'
import {
    AccountTypes,
    useAccountLogicalType,
    type AccountLogicalType,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { SvgProps } from 'react-native-svg'

const THEME_TOKEN = '__theme__'
const FALLBACK_ASSET = `accounts/${THEME_TOKEN}/unknown-account`

export type AccountIconProps = {
    account?: WalletAccount
    size?: 'sm' | 'md' | 'lg' | 'xl'
} & SvgProps

const iconNames = {
    Algo25: `accounts/${THEME_TOKEN}/algo25-account`,
    HdKey: `accounts/${THEME_TOKEN}/hdwallet-account`,
    LedgerBle: `accounts/${THEME_TOKEN}/ledger-account`,
    Multisig: `accounts/${THEME_TOKEN}/multisig-account`,
    Rekeyed: `accounts/${THEME_TOKEN}/rekeyed-standard`,
    RekeyedAuth: `accounts/${THEME_TOKEN}/rekeyed-standard`,
    NoAuth: `accounts/${THEME_TOKEN}/noauth-account`,
} satisfies Record<AccountLogicalType, string>

const resolveIconAsset = (
    logicalType: AccountLogicalType,
    account: WalletAccount,
): string => {
    const isRekeyedHardware =
        (logicalType === 'Rekeyed' || logicalType === 'RekeyedAuth') &&
        account.type === AccountTypes.hardware
    if (isRekeyedHardware) {
        return `accounts/${THEME_TOKEN}/rekeyed-ledger`
    }
    return iconNames[logicalType] ?? FALLBACK_ASSET
}

export const AccountIcon = (props: AccountIconProps) => {
    const { account, size = 'md', ...rest } = props
    const darkmode = useIsDarkMode()
    const logicalType = useAccountLogicalType(account?.address)

    const icon = useMemo(() => {
        if (!account || !logicalType) return <></>

        const theme = darkmode ? 'dark' : 'light'
        const icon = resolveIconAsset(logicalType, account)
        const iconName: IconName = icon.replaceAll(
            THEME_TOKEN,
            theme,
        ) as IconName
        return (
            <PWIcon
                {...rest}
                name={iconName}
                size={size}
            />
        )
    }, [account, logicalType, darkmode, rest, size])

    return icon
}
