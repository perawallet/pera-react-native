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

import {
    PWBottomSheet,
    PWDivider,
    PWIcon,
    PWListItem,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAccountOptions } from './useAccountOptions'
import { RenameAccountBottomSheet } from './RenameAccountBottomSheet'
import { RemoveAccountConfirmBottomSheet } from './RemoveAccountConfirmBottomSheet'
import { ReceiveFundsBottomSheet } from '@modules/transactions/components/ReceiveFunds/ReceiveFundsBottomSheet/ReceiveFundsBottomSheet'

export type AccountOptionsBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    account: WalletAccount
}

export const AccountOptionsBottomSheet = ({
    isVisible,
    onClose,
    account,
}: AccountOptionsBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        options,
        isRenameVisible,
        handleCloseRename,
        handleRename,
        isRemoveConfirmVisible,
        handleCloseRemoveConfirm,
        handleConfirmRemove,
        isQrVisible,
        handleCloseQr,
    } = useAccountOptions(account, onClose)

    const generalOptions = options.filter(
        o =>
            o.id === 'copy-address' ||
            o.id === 'show-qr' ||
            o.id === 'view-passphrase' ||
            o.id === 'auth-address',
    )

    const rekeyOptions = options.filter(
        o =>
            o.id === 'undo-rekey' ||
            o.id === 'rekey-to-ledger' ||
            o.id === 'rekey-to-standard',
    )

    const managementOptions = options.filter(
        o =>
            o.id === 'rename-account' ||
            o.id === 'toggle-notifications' ||
            o.id === 'remove-account',
    )

    return (
        <>
            <PWBottomSheet
                isVisible={isVisible}
                onBackdropPress={onClose}
                innerContainerStyle={styles.container}
            >
                <PWToolbar
                    right={
                        <PWIcon
                            name='cross'
                            onPress={onClose}
                        />
                    }
                />
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('account_options.title')}
                </PWText>

                <PWView>
                    {generalOptions.map(option => (
                        <PWListItem
                            key={option.id}
                            icon={option.icon}
                            title={option.title}
                            onPress={option.onPress}
                        />
                    ))}
                </PWView>

                {rekeyOptions.length > 0 && (
                    <>
                        <PWDivider style={styles.divider} />
                        <PWView>
                            {rekeyOptions.map(option => (
                                <PWListItem
                                    key={option.id}
                                    icon={option.icon}
                                    title={option.title}
                                    onPress={option.onPress}
                                />
                            ))}
                        </PWView>
                    </>
                )}

                <PWDivider style={styles.divider} />
                <PWView>
                    {managementOptions.map(option => (
                        <PWListItem
                            key={option.id}
                            icon={option.icon}
                            title={option.title}
                            onPress={option.onPress}
                        />
                    ))}
                </PWView>
            </PWBottomSheet>

            <RenameAccountBottomSheet
                isVisible={isRenameVisible}
                onClose={handleCloseRename}
                onRename={handleRename}
                currentName={account.name ?? ''}
            />

            <RemoveAccountConfirmBottomSheet
                isVisible={isRemoveConfirmVisible}
                onClose={handleCloseRemoveConfirm}
                onConfirm={handleConfirmRemove}
            />

            <ReceiveFundsBottomSheet
                isVisible={isQrVisible}
                onClose={handleCloseQr}
                account={account}
            />
        </>
    )
}
