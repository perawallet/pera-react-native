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

import { Trans } from 'react-i18next'
import type { InboxItem as InboxItemModel } from '@perawallet/wallet-core-messages'
import {
    truncateAlgorandAddress,
    formatRelativeTime,
} from '@perawallet/wallet-core-shared'
import {
    PWIcon,
    PWText,
    PWTouchableOpacity,
    type IconName,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { InboxItemShell } from '../InboxItemShell'
import { useStyles } from './styles'

type MultisigInvitationItem = Extract<
    InboxItemModel,
    { type: 'multisig_import' }
>

export type MultisigInvitationInboxItemProps = {
    item: MultisigInvitationItem
    onPress?: () => void
}

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

    const truncatedAddress = truncateAlgorandAddress(item.data.address)
    const relativeTime = formatRelativeTime(item.createdAt)

    return (
        <InboxItemShell
            item={item}
            align='top'
            onPress={onPress}
            testID='multisig_invitation_inbox_item'
            icon={
                <PWIcon
                    name={avatarIcon}
                    size='lg'
                />
            }
            title={
                <Trans
                    i18nKey='messages.inbox.invitation_title'
                    values={{ address: truncatedAddress }}
                    components={[
                        <PWText
                            key='bold'
                            variant='bodySemibold'
                        />,
                    ]}
                />
            }
            body={
                <>
                    <PWTouchableOpacity
                        style={styles.cta}
                        onPress={onPress}
                        disabled={!onPress}
                        testID='multisig_invitation_inbox_item_cta'
                    >
                        <PWText variant='bodySemibold'>
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
                </>
            }
        />
    )
}
