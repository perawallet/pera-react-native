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

import type { InboxItem as InboxItemModel } from '@perawallet/wallet-core-messages'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { formatRelativeTime } from '@perawallet/wallet-core-shared'
import {
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
    type IconName,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { UnreadIndicator } from '../../UnreadIndicator'
import { isPendingAction } from '../isPendingAction'
import { useStyles } from './styles'

type MultisigInvitationItem = Extract<
    InboxItemModel,
    { type: 'multisig_import' }
>

export type MultisigInvitationInboxItemProps = {
    item: MultisigInvitationItem
    onPress?: () => void
}

const TRUNCATED_ADDRESS_LENGTH = 8

export const MultisigInvitationInboxItem = ({
    item,
    onPress,
}: MultisigInvitationInboxItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const isDark = useIsDarkMode()

    const avatarIcon: IconName = isDark
        ? 'accounts/dark/multisig-account'
        : 'accounts/light/multisig-account'

    const truncatedAddress = truncateAlgorandAddress(
        item.data.address,
        TRUNCATED_ADDRESS_LENGTH,
    )
    const relativeTime = formatRelativeTime(item.createdAt)

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
            disabled={!onPress}
            testID='multisig_invitation_inbox_item'
        >
            <PWView style={styles.indicatorSlot}>
                <UnreadIndicator isUnread={isPendingAction(item)} />
            </PWView>
            <PWIcon
                name={avatarIcon}
                size='lg'
            />
            <PWView style={styles.content}>
                <PWText style={styles.title}>
                    <PWText style={styles.titleBold}>
                        {t('messages.inbox.invitation_title_bold')}
                    </PWText>
                    {t('messages.inbox.invitation_title_suffix')}
                    {truncatedAddress}
                </PWText>
                <PWTouchableOpacity
                    style={styles.cta}
                    onPress={onPress}
                    disabled={!onPress}
                    testID='multisig_invitation_inbox_item_cta'
                >
                    <PWText style={styles.ctaText}>
                        {t('messages.inbox.view_invitation_details')}
                    </PWText>
                    <PWIcon
                        name='chevron-right'
                        size='xs'
                    />
                </PWTouchableOpacity>
                <PWText
                    variant='caption'
                    style={styles.timestamp}
                >
                    {relativeTime}
                </PWText>
            </PWView>
        </PWTouchableOpacity>
    )
}
