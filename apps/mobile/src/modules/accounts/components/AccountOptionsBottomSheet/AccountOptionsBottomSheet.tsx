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
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { WalletAccount, isWatchAccount } from '@perawallet/wallet-core-accounts'
import { ViewPassphraseFlow } from '@modules/view-passphrase'
import { useStyles } from './styles'
import { AccountOption, useAccountOptions } from './useAccountOptions'
import { RenameAccountBottomSheet } from './RenameAccountBottomSheet'
import { BackupWarningBottomSheet } from './BackupWarningBottomSheet'
import { RemoveAccountConfirmBottomSheet } from './RemoveAccountConfirmBottomSheet'
import { AccountInfoCard } from '../AccountInfoCard'
import { ExportShareAccountBottomSheet } from '@modules/multisig/components/ExportShareAccountBottomSheet'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'

export type AccountOptionsBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onShowAddress: () => void
    account: WalletAccount
}

const OptionRow = ({
    option,
    styles,
}: {
    option: AccountOption
    styles: ReturnType<typeof useStyles>
}) => {
    const isDestructive = option.variant === 'destructive'

    return (
        <PWTouchableOpacity
            style={styles.optionRow}
            onPress={option.onPress}
        >
            <PWIcon
                name={option.icon}
                variant={isDestructive ? 'error' : 'primary'}
            />
            <PWView style={styles.optionTextContainer}>
                <PWText
                    variant='h4'
                    style={isDestructive ? styles.dangerText : undefined}
                >
                    {option.title}
                </PWText>
                {option.subtitle ? (
                    <PWText
                        variant='body'
                        style={styles.optionSubtitle}
                        numberOfLines={1}
                    >
                        {option.subtitle}
                    </PWText>
                ) : null}
            </PWView>
        </PWTouchableOpacity>
    )
}

export const AccountOptionsBottomSheet = ({
    isVisible,
    onClose,
    onShowAddress,
    account,
}: AccountOptionsBottomSheetProps) => {
    const styles = useStyles()
    const {
        options,
        isRenameVisible,
        handleCloseRename,
        handleRename,
        isBackupWarningVisible,
        handleCloseBackupWarning,
        handleBackupWarningContinue,
        isRemoveConfirmVisible,
        handleCloseRemoveConfirm,
        handleConfirmRemove,
        isPassphraseFlowVisible,
        handleClosePassphraseFlow,
        isExportShareVisible,
        handleCloseExportShare,
    } = useAccountOptions({ account, onClose, onShowAddress })

    const generalOptions = options.filter(
        o =>
            o.id === 'copy-address' ||
            o.id === 'show-address' ||
            o.id === 'view-passphrase' ||
            o.id === 'auth-address',
    )

    const rekeyOptions = options.filter(
        o =>
            o.id === 'undo-rekey' ||
            o.id === 'rekey-to-ledger' ||
            o.id === 'rekey-to-standard' ||
            o.id === 'rekey-to-shared' ||
            o.id === 'export-share-account',
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
                enablePanDownToClose
                autoCreateContainer={false}
                size='lg'
            >
                <BottomSheetScrollView
                    contentContainerStyle={styles.container}
                    showsVerticalScrollIndicator={false}
                >
                    <PWView style={styles.accountInfoContainer}>
                        <AccountInfoCard
                            account={account}
                            onClose={onClose}
                        />
                    </PWView>

                    <PWView>
                        {generalOptions.map(option => (
                            <OptionRow
                                key={option.id}
                                option={option}
                                styles={styles}
                            />
                        ))}
                    </PWView>

                    {rekeyOptions.length > 0 && (
                        <>
                            <PWDivider style={styles.divider} />
                            <PWView>
                                {rekeyOptions.map(option => (
                                    <OptionRow
                                        key={option.id}
                                        option={option}
                                        styles={styles}
                                    />
                                ))}
                            </PWView>
                        </>
                    )}
                    <PWDivider style={styles.divider} />

                    <PWDivider style={styles.divider} />
                    <PWView>
                        {managementOptions.map(option => (
                            <OptionRow
                                key={option.id}
                                option={option}
                                styles={styles}
                            />
                        ))}
                    </PWView>
                </BottomSheetScrollView>
            </PWBottomSheet>

            <RenameAccountBottomSheet
                isVisible={isRenameVisible}
                onClose={handleCloseRename}
                onRename={handleRename}
                currentName={account.name ?? ''}
            />

            <BackupWarningBottomSheet
                isVisible={isBackupWarningVisible}
                onClose={handleCloseBackupWarning}
                onContinue={handleBackupWarningContinue}
            />

            <RemoveAccountConfirmBottomSheet
                isVisible={isRemoveConfirmVisible}
                isWatchAccount={isWatchAccount(account)}
                onClose={handleCloseRemoveConfirm}
                onConfirm={handleConfirmRemove}
            />

            <ViewPassphraseFlow
                isVisible={isPassphraseFlowVisible}
                address={account.address}
                onClose={handleClosePassphraseFlow}
            />

            <ExportShareAccountBottomSheet
                isVisible={isExportShareVisible}
                onClose={handleCloseExportShare}
                accountAddress={account.address}
            />
        </>
    )
}
