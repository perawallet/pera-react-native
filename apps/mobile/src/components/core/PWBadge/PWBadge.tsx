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

import { Badge, type BadgeProps } from '@rneui/themed'
import { MAX_FONT_SIZE_MULTIPLIER } from '../constants'
import { useStyles } from './styles'

export type PWBadgeProps = {
    variant?: 'primary' | 'testnet' | 'secondary' | 'positive' | 'alert' | 'new'
} & BadgeProps

export const PWBadge = ({
    variant = 'primary',
    badgeStyle,
    textStyle,
    textProps,
    ...rest
}: PWBadgeProps) => {
    const styles = useStyles({ variant })
    return (
        <Badge
            badgeStyle={[styles.container, badgeStyle]}
            textStyle={[styles.text, textStyle]}
            // RNEUI renders the label through a bare RN Text, so nothing bounds
            // OS font scaling here the way PWText does for every other string.
            textProps={{
                maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
                ...textProps,
            }}
            {...rest}
        ></Badge>
    )
}
