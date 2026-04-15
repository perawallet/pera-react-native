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
    AccountStatus,
    resolveAccountStatus,
    useAllAccounts,
    useAccountAuthAddresses,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { SvgProps } from 'react-native-svg'

const THEME_TOKEN = '__theme__'
const FALLBACK_ASSET = `accounts/${THEME_TOKEN}/unknown-account`

export type AccountIconProps = {
    account?: WalletAccount
    size?: 'sm' | 'md' | 'lg' | 'xl'
} & SvgProps

const iconNames: Record<AccountStatus, string> = {
    hdWallet: `accounts/${THEME_TOKEN}/hdwallet-account`,
    hardware: `accounts/${THEME_TOKEN}/ledger-account`,
    multisig: `accounts/${THEME_TOKEN}/multisig-account`,
    noAuth: `accounts/${THEME_TOKEN}/noauth-account`,
    rekeyedHardware: `accounts/${THEME_TOKEN}/rekeyed-ledger`,
    rekeyedStandard: `accounts/${THEME_TOKEN}/rekeyed-standard`,
    standard: `accounts/${THEME_TOKEN}/algo25-account`,
    watch: `accounts/${THEME_TOKEN}/watch-account`,
}

export const AccountIcon = (props: AccountIconProps) => {
    const { account, size = 'md', ...rest } = props
    const darkmode = useIsDarkMode()
    const accounts = useAllAccounts()
    const { authAddresses } = useAccountAuthAddresses()

    const icon = useMemo(() => {
        if (!account) return <></>

        const theme = darkmode ? 'dark' : 'light'
        const accountStatus = resolveAccountStatus(
            account,
            accounts,
            authAddresses.get(account.address),
        )
        const icon = iconNames[accountStatus] ?? FALLBACK_ASSET
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
    }, [account, rest])

    return icon
}
