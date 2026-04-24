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
import { PWIcon, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { InboxItemShell } from '../InboxItemShell'
import { useStyles } from '../styles'

type MultisigSignItem = Extract<InboxItemModel, { type: 'multisig_sign' }>

export type MultisigSignInboxItemProps = {
    item: MultisigSignItem
    onPress?: () => void
}

export const MultisigSignInboxItem = ({
    item,
    onPress,
}: MultisigSignInboxItemProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const icon = (
        <PWView style={styles.iconContainer}>
            <PWIcon
                name='edit-pen'
                variant='secondary'
                size='lg'
            />
        </PWView>
    )

    return (
        <InboxItemShell
            item={item}
            onPress={onPress}
            icon={icon}
            title={t('messages.inbox.multisig_sign')}
            subtitle={item.data.status}
        />
    )
}
