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

import React, { useCallback } from 'react'
import {
    PWView,
    PWText,
    PWIcon,
    PWTouchableOpacity,
    PWCheckbox,
    PWChip,
    PWRoundIcon,
} from '@components/core'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { CopyableText } from '@components/CopyableText'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { getContainerTestProps } from '@utils/test-id-helper'
import { useStyles } from './styles'
import { RekeyedAccountInfoContent } from './RekeyedAccountInfoContent'

type ImportRekeyedAddressesItemProps = {
    account: WalletAccount
    itemIndex: number
    isImported: boolean
    isSelected: boolean
    onToggle: (address: string) => void
}

export const ImportRekeyedAddressesItem = ({
    account,
    itemIndex,
    isImported,
    isSelected,
    onToggle,
}: ImportRekeyedAddressesItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()

    const handleOpenInfo = useCallback(() => {
        requestBottomSheet<void>({
            contents: <RekeyedAccountInfoContent account={account} />,
            options: {
                size: 'lg',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, account])

    return (
        <PWView
            style={styles.itemContainer}
            {...getContainerTestProps(
                `import_rekeyed_addresses_item_${itemIndex}`,
            )}
        >
            {!isImported && (
                <PWView style={styles.checkboxWrapper}>
                    <PWCheckbox
                        checked={isSelected}
                        onPress={() => onToggle(account.address)}
                        containerStyle={styles.checkboxContainer}
                        testID={`import_rekeyed_addresses_item_checkbox_${itemIndex}`}
                    />
                </PWView>
            )}

            <PWTouchableOpacity
                style={styles.itemContent}
                onPress={() => onToggle(account.address)}
                disabled={isImported}
            >
                <PWView style={styles.iconContainer}>
                    <PWRoundIcon
                        icon='account-rekeyed'
                        variant='helper'
                        size='md'
                    />
                </PWView>

                <PWView style={styles.itemTextContainer}>
                    <CopyableText copyValue={account.address}>
                        <PWText
                            variant='body'
                            style={styles.itemTitle}
                        >
                            {truncateAlgorandAddress(account.address)}
                        </PWText>
                    </CopyableText>
                    <PWText
                        variant='caption'
                        style={styles.itemSubtitle}
                    >
                        {t(
                            'onboarding.import_rekeyed_addresses.rekeyed_account_subtitle',
                        )}
                    </PWText>
                </PWView>
            </PWTouchableOpacity>

            <PWTouchableOpacity
                style={styles.infoIconContainer}
                onPress={handleOpenInfo}
                testID={`import_rekeyed_addresses_item_info_${itemIndex}`}
            >
                <PWIcon
                    name='info'
                    size='md'
                    variant='secondary'
                />
            </PWTouchableOpacity>

            {isImported && (
                <PWChip
                    title={t(
                        'onboarding.import_rekeyed_addresses.already_imported',
                    )}
                    variant='secondary'
                />
            )}
        </PWView>
    )
}
