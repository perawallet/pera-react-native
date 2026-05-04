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

import { makeStyles } from '@rneui/themed'
import type { AccountIconSize } from '../styles'

export type AccountIconBadgeSize = Extract<AccountIconSize, 'lg' | 'xl'>

type StyleProps = {
    size: AccountIconBadgeSize
    isMultiDigit: boolean
}

export const useStyles = makeStyles(
    (theme, { size, isMultiDigit }: StyleProps) => {
        const dimensions = {
            lg: {
                diameter: theme.spacing.md + theme.spacing.sm,
                borderWidth: theme.borders.sm,
            },
            xl: {
                diameter: theme.spacing.xl,
                borderWidth: theme.borders.md,
            },
        }[size]

        return {
            container: {
                position: 'absolute',
                bottom: -theme.spacing.xs,
                right: -theme.spacing.xs,
                height: dimensions.diameter,
                minWidth: dimensions.diameter,
                paddingHorizontal: isMultiDigit ? theme.spacing.xxs : 0,
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.layerGray,
                borderWidth: dimensions.borderWidth,
                borderRadius: theme.borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                ...theme.shadows.md,
            },
            text: {
                color: theme.colors.wallet1Icon,
                textAlign: 'center',
            },
        }
    },
)
