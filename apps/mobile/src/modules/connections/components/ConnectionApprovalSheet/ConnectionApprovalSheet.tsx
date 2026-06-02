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

import { useState } from 'react'
import {
    useSigningAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    PWButton,
    PWCheckbox,
    PWFlatList,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import {
    DappConnectionHeader,
    type DappConnectionHeaderProps,
} from '../DappConnectionHeader'
import { useStyles } from './styles'

export type ConnectionApprovalSheetProps = DappConnectionHeaderProps & {
    /** "SELECT ACCOUNT(S)" header above the account list. */
    accountsTitle: string
    onApprove: (addresses: string[]) => void
    onReject: () => void
}

/**
 * Shared pre-connection approval sheet for WalletConnect: multi-account
 * selection via checkboxes. The protocol supplies its identity (via
 * `DappConnectionHeader`), requested networks and permissions; this sheet adds
 * the account picker and the Cancel/Connect actions. (Liquid Auth's
 * single-account, identity-later flow uses `SelectAccountContent` instead.)
 */
export const ConnectionApprovalSheet = ({
    accountsTitle,
    onApprove,
    onReject,
    ...headerProps
}: ConnectionApprovalSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const accounts = useSigningAccounts()
    const [selected, setSelected] = useState<string[]>([])

    const toggleAccount = (address: string) => {
        setSelected(prev =>
            prev.includes(address)
                ? prev.filter(item => item !== address)
                : [...prev, address],
        )
    }

    const renderAccountRow = ({ item }: { item: WalletAccount }) => (
        <PWTouchableOpacity
            key={item.address}
            style={styles.accountItem}
            onPress={() => toggleAccount(item.address)}
        >
            <AccountDisplay
                account={item}
                showChevron={false}
            />
            <PWCheckbox
                checked={selected.includes(item.address)}
                onPress={() => toggleAccount(item.address)}
            />
        </PWTouchableOpacity>
    )

    const ListHeader = (
        <>
            <DappConnectionHeader {...headerProps} />
            <PWView style={styles.accountSelectionContainer}>
                <PWText
                    variant='h4'
                    style={styles.accountsTitle}
                >
                    {accountsTitle}
                </PWText>
            </PWView>
        </>
    )

    return (
        <>
            <PWFlatList
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                data={accounts}
                renderItem={renderAccountRow}
                extraData={{ selected }}
                ListHeaderComponent={ListHeader}
                showsVerticalScrollIndicator={false}
                inBottomSheet
            />
            <PWView style={styles.buttonContainer}>
                <PWButton
                    variant='secondary'
                    title={t('common.cancel.label')}
                    onPress={onReject}
                    style={styles.cancelButton}
                />
                <PWButton
                    variant='primary'
                    title={t('common.connect.label')}
                    onPress={() => onApprove(selected)}
                    style={styles.connectButton}
                    isDisabled={!selected.length}
                />
            </PWView>
        </>
    )
}
