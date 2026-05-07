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

import { useMemo } from 'react'
import { PWBottomSheet, PWDivider, PWView } from '@components/core'
import { WalletAccount, isWatchAccount } from '@perawallet/wallet-core-accounts'
import { ViewPassphraseFlow } from '@modules/view-passphrase'
import { useStyles } from './styles'
import { useAccountOptions } from './useAccountOptions'
import { AccountOptionsRow } from './AccountOptionsRow'
import { RenameAccountBottomSheet } from './RenameAccountBottomSheet'
import { BackupWarningBottomSheet } from './BackupWarningBottomSheet'
import { RemoveAccountConfirmBottomSheet } from './RemoveAccountConfirmBottomSheet'
import { AccountInfoCard } from '../AccountInfoCard'
import { ExportShareAccountBottomSheet } from '@modules/multisig/components/ExportShareAccountBottomSheet'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'

import type { AccountOption } from './useAccountOptions'

export type AccountOptionsBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onShowAddress: () => void
    account: WalletAccount
}

const GENERAL_IDS: ReadonlySet<AccountOption['id']> = new Set([
    'copy-address',
    'show-address',
    'view-passphrase',
    'auth-address',
])

const REKEY_IDS: ReadonlySet<AccountOption['id']> = new Set([
    'undo-rekey',
    'rekey-to-ledger',
    'rekey-to-standard',
    'rekey-to-shared',
    'rescan-rekeyed',
    'export-share-account',
])

const MANAGEMENT_IDS: ReadonlySet<AccountOption['id']> = new Set([
    'rename-account',
    'toggle-notifications',
    'remove-account',
])

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

    const { generalOptions, rekeyOptions, managementOptions } = useMemo(() => {
        const general: AccountOption[] = []
        const rekey: AccountOption[] = []
        const management: AccountOption[] = []
        for (const option of options) {
            if (GENERAL_IDS.has(option.id)) general.push(option)
            else if (REKEY_IDS.has(option.id)) rekey.push(option)
            else if (MANAGEMENT_IDS.has(option.id)) management.push(option)
        }
        return {
            generalOptions: general,
            rekeyOptions: rekey,
            managementOptions: management,
        }
    }, [options])

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
                            <AccountOptionsRow
                                key={option.id}
                                option={option}
                            />
                        ))}
                    </PWView>

                    {rekeyOptions.length > 0 && (
                        <>
                            <PWDivider style={styles.divider} />
                            <PWView>
                                {rekeyOptions.map(option => (
                                    <AccountOptionsRow
                                        key={option.id}
                                        option={option}
                                    />
                                ))}
                            </PWView>
                        </>
                    )}

                    <PWDivider style={styles.divider} />
                    <PWView>
                        {managementOptions.map(option => (
                            <AccountOptionsRow
                                key={option.id}
                                option={option}
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
