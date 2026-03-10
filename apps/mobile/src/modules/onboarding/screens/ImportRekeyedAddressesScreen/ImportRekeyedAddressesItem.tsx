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

import React from 'react'
import {
    PWView,
    PWText,
    PWIcon,
    PWTouchableOpacity,
    PWCheckbox,
    PWChip,
    PWRoundIcon,
} from '@components/core'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useStyles } from './styles'

type ImportRekeyedAddressesItemProps = {
    account: WalletAccount
    isImported: boolean
    isSelected: boolean
    onToggle: (address: string) => void
}

export const ImportRekeyedAddressesItem = ({
    account,
    isImported,
    isSelected,
    onToggle,
}: ImportRekeyedAddressesItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { infoToast } = useToast()

    return (
        <PWView
            style={styles.itemContainer}
            testID={`import_rekeyed_addresses_item_${account.address}`}
        >
            {!isImported && (
                <PWView style={styles.checkboxWrapper}>
                    <PWCheckbox
                        checked={isSelected}
                        onPress={() => onToggle(account.address)}
                        containerStyle={styles.checkboxContainer}
                        testID={`import_rekeyed_addresses_item_checkbox_${account.address}`}
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
                    <PWText
                        variant='body'
                        style={styles.itemTitle}
                        numberOfLines={1}
                        ellipsizeMode='middle'
                    >
                        {account.address}
                    </PWText>
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
                onPress={() =>
                    infoToast(
                        t('common.not_implemented.title'),
                        t('common.not_implemented.body'),
                    )
                }
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
