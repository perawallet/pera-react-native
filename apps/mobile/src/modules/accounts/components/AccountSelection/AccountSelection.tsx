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

import { useCallback } from 'react'
import {
    useSelectedAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'
import { AccountMenuBottomSheet } from '@modules/accounts/components/AccountMenuBottomSheet'
import { useModalState } from '@hooks/useModalState'
import { useAppNavigation } from '@hooks/useAppNavigation'

import { TouchableOpacity, TouchableOpacityProps } from 'react-native'
import { AccountDisplay } from '../AccountDisplay'

export type AccountSelectionProps = {
    onSelected?: (account: WalletAccount) => void
} & TouchableOpacityProps

export const AccountSelection = ({
    onSelected,
    ...props
}: AccountSelectionProps) => {
    const styles = useStyles()
    const account = useSelectedAccount()
    const accountMenuState = useModalState()
    const navigation = useAppNavigation()

    const handleSelected = (selectedAccount: WalletAccount) => {
        accountMenuState.close()
        onSelected?.(selectedAccount)
    }

    const handleAddAccount = useCallback(() => {
        accountMenuState.close()
        navigation.navigate('AddAccount', { screen: 'AddAccountHome' })
    }, [accountMenuState, navigation])

    return (
        <>
            <TouchableOpacity
                {...props}
                activeOpacity={0.8}
                onPress={accountMenuState.open}
                testID='account_selection_button'
            >
                <AccountDisplay
                    account={account ?? undefined}
                    style={styles.container}
                    noBorder
                />
            </TouchableOpacity>
            <AccountMenuBottomSheet
                isVisible={accountMenuState.isOpen}
                onClose={accountMenuState.close}
                onSelected={handleSelected}
                onAddAccount={handleAddAccount}
            />
        </>
    )
}
