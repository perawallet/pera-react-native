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

import { PWText, PWView } from '@components/core'
import { AccountIconBadgeSize, useStyles } from './styles'

const MAX_DISPLAY_COUNT = 99

export type AccountIconBadgeProps = {
    count: number
    size: AccountIconBadgeSize
}

export const AccountIconBadge = ({ count, size }: AccountIconBadgeProps) => {
    const formatted =
        count > MAX_DISPLAY_COUNT ? `${MAX_DISPLAY_COUNT}+` : String(count)
    const isMultiDigit = formatted.length > 1
    const styles = useStyles({ size, isMultiDigit })

    return (
        <PWView style={styles.container}>
            <PWText
                variant='bodyCompact'
                style={styles.text}
                testID='account-icon-badge'
            >
                {formatted}
            </PWText>
        </PWView>
    )
}
