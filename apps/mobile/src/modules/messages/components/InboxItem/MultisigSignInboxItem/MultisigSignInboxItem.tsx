/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { InboxItemShell } from '../InboxItemShell'
import { useStyles } from './styles'
import { useMultisigSignInboxItem } from './useMultisigSignInboxItem'

type MultisigSignItem = Extract<InboxItemModel, { type: 'multisig_sign' }>

export type MultisigSignInboxItemProps = {
    item: MultisigSignItem
    onPress?: () => void
}

export const MultisigSignInboxItem = ({
    item,
    onPress,
}: MultisigSignInboxItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        avatarIcon,
        truncatedAddress,
        relativeTime,
        isWaiting,
        isSuccess,
        isFailure,
        statusKey,
        signedCount,
        threshold,
        timeRemaining,
    } = useMultisigSignInboxItem(item)

    const statusStyle = isFailure
        ? styles.statusTextFailure
        : isSuccess
          ? styles.statusTextSuccess
          : styles.statusTextWaiting

    return (
        <InboxItemShell
            item={item}
            align='top'
            onPress={onPress}
            testID='multisig_sign_inbox_item'
            icon={
                <PWIcon
                    name={avatarIcon}
                    size='lg'
                />
            }
            title={
                <Trans
                    i18nKey='messages.inbox.multisig_sign.title'
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
                    <PWView style={styles.statusRow}>
                        <PWText
                            variant='caption'
                            style={statusStyle}
                            testID='multisig_sign_inbox_item_status'
                        >
                            {t(statusKey)}
                        </PWText>
                        <PWText
                            variant='caption'
                            style={styles.timestamp}
                        >
                            {`· ${relativeTime}`}
                        </PWText>
                    </PWView>
                    {isWaiting && (
                        <PWView style={styles.badgeRow}>
                            <PWView
                                style={styles.badge}
                                testID='multisig_sign_inbox_item_signed_badge'
                            >
                                <PWIcon
                                    name='check'
                                    size='sm'
                                    variant='secondary'
                                />
                                <PWText
                                    variant='caption'
                                    style={styles.badgeText}
                                >
                                    {t('multisig.pending_signatures.x_of_y', {
                                        signed: signedCount,
                                        total: threshold,
                                    })}
                                </PWText>
                            </PWView>
                            {!!timeRemaining && (
                                <PWView
                                    style={styles.badge}
                                    testID='multisig_sign_inbox_item_time_badge'
                                >
                                    <PWText
                                        variant='caption'
                                        style={styles.badgeText}
                                    >
                                        {t(
                                            'multisig.pending_signatures.time_left',
                                            { time: timeRemaining },
                                        )}
                                    </PWText>
                                </PWView>
                            )}
                        </PWView>
                    )}
                </>
            }
        />
    )
}
