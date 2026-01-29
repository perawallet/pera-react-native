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
import { Algo25Account } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type ImportRekeyedAddressesItemProps = {
    account: Algo25Account
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

    return (
        <PWTouchableOpacity
            style={styles.itemContainer}
            onPress={() => onToggle(account.address)}
            disabled={isImported}
        >
            {!isImported && (
                <PWView style={styles.checkboxWrapper}>
                    <PWCheckbox
                        checked={isSelected}
                        onPress={() => onToggle(account.address)}
                        containerStyle={styles.checkboxContainer}
                    />
                </PWView>
            )}

            <PWView style={styles.itemContent}>
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

                <PWView style={styles.infoIconContainer}>
                    <PWIcon
                        name='info'
                        size='md'
                        variant='secondary'
                    />
                </PWView>
            </PWView>

            {isImported && (
                <PWChip
                    title={t(
                        'onboarding.import_rekeyed_addresses.already_imported',
                    )}
                    variant='secondary'
                />
            )}
        </PWTouchableOpacity>
    )
}
