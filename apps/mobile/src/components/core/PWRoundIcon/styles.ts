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

import { PWRoundIconProps } from './PWRoundIcon'

export const useStyles = makeStyles((theme, props: PWRoundIconProps) => {
    const { variant = 'secondary', size = 'lg' } = props

    const sizeMap: Record<string, number> = {
        xs: theme.spacing.xl,
        sm: theme.spacing.xxl,
        md: theme.spacing['3xl'],
        lg: theme.spacing['4xl'],
        xl: theme.spacing['5xl'],
    }

    const buttonSize = sizeMap[size] || theme.spacing['3xl']

    const backgroundColor =
        variant === 'primary'
            ? theme.colors.buttonPrimaryBg
            : variant === 'helper'
              ? theme.colors.buttonSquareBg
              : theme.colors.layerGrayLighter

    return {
        container: {
            backgroundColor,
            width: buttonSize,
            height: buttonSize,
            alignContent: 'center',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: buttonSize / 2,
        },
    }
})
