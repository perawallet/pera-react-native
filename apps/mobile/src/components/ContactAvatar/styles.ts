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

import { makeStyles } from '@rneui/themed'
import type { PWIconSize } from '@components/core'

export type ContactAvatarVariant = 'default' | 'highlighted'

type StyleProps = {
    size: PWIconSize
    variant: ContactAvatarVariant
}

export const useStyles = makeStyles((theme, { size, variant }: StyleProps) => {
    const containerSize = {
        xs: theme.spacing.lg,
        sm: theme.spacing.xl,
        md: theme.spacing.xxl,
        lg: theme.spacing['3xl'],
        xl: theme.spacing['4xl'],
        xxl: theme.spacing['5xl'],
        '3xl': theme.spacing['5xl'],
    }[size]

    return {
        container: {
            width: containerSize,
            height: containerSize,
            borderRadius: containerSize,
            overflow: 'hidden',
            backgroundColor:
                variant === 'highlighted'
                    ? theme.colors.wallet1Icon
                    : theme.colors.layerGrayLighter,
            alignItems: 'center',
            justifyContent: 'center',
        },
        image: {
            width: containerSize,
            height: containerSize,
        },
    }
})
