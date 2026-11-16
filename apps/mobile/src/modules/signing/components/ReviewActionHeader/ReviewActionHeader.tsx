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

import type { ReactNode } from 'react'
import { PWText, PWView, type IconName } from '@components/core'
import { TransactionIcon } from '@components/TransactionIcon'
import { useStyles } from './styles'

export type ReviewActionHeaderProps = {
    iconName: IconName
    title: string
    /** What the action is aimed at: a contract, a recipient or an app. */
    target?: ReactNode
}

export const ReviewActionHeader = ({
    iconName,
    title,
    target,
}: ReviewActionHeaderProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={styles.container}
            testID='review_action_header'
        >
            <TransactionIcon
                name={iconName}
                size='lg'
            />
            <PWText
                variant='h2'
                weight={600}
                style={styles.title}
                testID='review_action_title'
            >
                {title}
            </PWText>
            {target}
        </PWView>
    )
}
