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

import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import {
    IconName,
    PWDivider,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAccountActions } from './useAccountActions'

export type AccountActionsContentProps = {
    address: string
    label?: string
}

type ActionRow = {
    id: string
    icon: IconName
    title: string
    subtitle: string
    onPress: () => void
}

export const AccountActionsContent = ({
    address,
    label,
}: AccountActionsContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()
    const {
        existingContact,
        openSendTransaction,
        openWatchAddress,
        openContact,
    } = useAccountActions({ address, label, onClose: dismiss })

    const contactAction: ActionRow = existingContact
        ? {
              id: 'edit-contact',
              icon: 'contacts',
              title: t('address_actions.edit_contact'),
              subtitle: t('address_actions.edit_contact_subtitle', {
                  name: existingContact.name,
              }),
              onPress: openContact,
          }
        : {
              id: 'add-contact',
              icon: 'contacts',
              title: t('address_actions.add_contact'),
              subtitle: t('address_actions.add_contact_subtitle'),
              onPress: openContact,
          }

    const actions: ActionRow[] = [
        {
            id: 'send-transaction',
            icon: 'transactions/send',
            title: t('address_actions.send_transaction'),
            subtitle: t('address_actions.send_transaction_subtitle'),
            onPress: openSendTransaction,
        },
        {
            id: 'watch-address',
            icon: 'eye',
            title: t('address_actions.watch_address'),
            subtitle: t('address_actions.watch_address_subtitle'),
            onPress: openWatchAddress,
        },
        contactAction,
    ]

    return (
        <BottomSheetScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        >
            <PWView style={styles.addressCard}>
                <PWText
                    variant='caption'
                    style={styles.addressLabel}
                >
                    {t('address_actions.title')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.addressText}
                    numberOfLines={2}
                    selectable
                >
                    {address}
                </PWText>
            </PWView>

            <PWDivider />

            {actions.map(action => (
                <PWTouchableOpacity
                    key={action.id}
                    style={styles.optionRow}
                    onPress={action.onPress}
                    testID={`account-actions-${action.id}`}
                >
                    <PWIcon
                        name={action.icon}
                        variant='primary'
                    />
                    <PWView style={styles.optionTextContainer}>
                        <PWText variant='h4'>{action.title}</PWText>
                        <PWText
                            variant='body'
                            style={styles.optionSubtitle}
                            numberOfLines={1}
                        >
                            {action.subtitle}
                        </PWText>
                    </PWView>
                </PWTouchableOpacity>
            ))}
        </BottomSheetScrollView>
    )
}
