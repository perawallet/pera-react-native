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

import { IconName, PWIcon, PWView } from '@components/core'

import { useMemo } from 'react'
import {
    AccountTypes,
    useCanSignWith,
    useRekeyAccount,
    type AccountType,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { SvgProps } from 'react-native-svg'
import { AccountIconSize, useStyles } from './styles'

const THEME_TOKEN = '__theme__'
const FALLBACK_ASSET = `accounts/${THEME_TOKEN}/unknown-account`

export type AccountIconProps = {
    account?: WalletAccount
    size?: AccountIconSize
    /**
     * When true, render the icon for the account's base `type` and ignore
     * its rekey state. Used by the undo-rekey preview to show what the
     * source would look like once the rekey is undone.
     */
    ignoreRekey?: boolean
} & SvgProps

const BASE_ICON: Record<AccountType, string> = {
    [AccountTypes.algo25]: `accounts/${THEME_TOKEN}/algo25-account`,
    [AccountTypes.hdWallet]: `accounts/${THEME_TOKEN}/hdwallet-account`,
    [AccountTypes.hardware]: `accounts/${THEME_TOKEN}/ledger-account`,
    [AccountTypes.multisig]: `accounts/${THEME_TOKEN}/multisig-account`,
    [AccountTypes.watch]: `accounts/${THEME_TOKEN}/watch-account`,
}

const REKEYED_SIGNABLE_ICON: Partial<Record<AccountType, string>> = {
    [AccountTypes.hardware]: `accounts/${THEME_TOKEN}/rekeyed-ledger`,
    [AccountTypes.multisig]: `accounts/${THEME_TOKEN}/rekeyed-multisig`,
}
const REKEYED_SIGNABLE_DEFAULT = `accounts/${THEME_TOKEN}/rekeyed-standard`
const REKEYED_UNSIGNABLE_ICON = `accounts/${THEME_TOKEN}/noauth-account`

export const AccountIcon = (props: AccountIconProps) => {
    const { account, size = 'md', ignoreRekey, ...rest } = props
    const darkmode = useIsDarkMode()
    const rekeyAccount = useRekeyAccount(account?.address)
    const canSign = useCanSignWith(account)
    const styles = useStyles({ size })

    const icon = useMemo(() => {
        if (!account) return null

        const isRekeyed = !ignoreRekey && !!account.rekeyAddress
        let asset: string
        if (isRekeyed && canSign) {
            asset =
                REKEYED_SIGNABLE_ICON[account.type] ?? REKEYED_SIGNABLE_DEFAULT
        } else if (isRekeyed && !canSign) {
            asset = REKEYED_UNSIGNABLE_ICON
        } else {
            asset = BASE_ICON[account.type] ?? FALLBACK_ASSET
        }

        const theme = darkmode ? 'dark' : 'light'
        const iconName: IconName = asset.replaceAll(
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
        // rekeyAccount keeps the memo invalidating when the auth account
        // changes (which can flip canSign).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account, ignoreRekey, canSign, rekeyAccount, darkmode, size, rest])

    if (!icon) return <></>

    return <PWView style={styles.container}>{icon}</PWView>
}
