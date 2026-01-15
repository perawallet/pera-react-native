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

import { PWIcon, IconName } from '@components/core/PWIcon'

import { useMemo } from 'react'
import { SvgProps } from 'react-native-svg'
import {
    isAlgo25Account,
    isHDWalletAccount,
    isLedgerAccount,
    isRekeyedAccount,
    isWatchAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useIsDarkMode } from '@hooks/theme'

export type AccountIconProps = {
    account?: WalletAccount
} & SvgProps

// TODO: Add governor badges (if needed - see Figma)
export const AccountIcon = (props: AccountIconProps) => {
    const { account, ...rest } = props
    const darkmode = useIsDarkMode()

    const icon = useMemo(() => {
        if (!account) return <></>

        const theme = darkmode ? 'dark' : 'light'
        let iconName: IconName = `accounts/${theme}/unknown-account`
        if (isHDWalletAccount(account)) {
            iconName = `accounts/${theme}/hdwallet-account`
        } else if (isAlgo25Account(account)) {
            iconName = `accounts/${theme}/algo25-account`
        } else if (isLedgerAccount(account)) {
            iconName = `accounts/${theme}/ledger-account`
        } else if (isWatchAccount(account)) {
            iconName = `accounts/${theme}/watch-account`
        } else if (isRekeyedAccount(account)) {
            iconName = `accounts/${theme}/rekeyed-account`
        }
        return (
            <PWIcon
                {...rest}
                name={iconName}
            />
        )
    }, [account, rest])

    return icon
}
