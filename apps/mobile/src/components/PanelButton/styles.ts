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
import type { PanelButtonProps } from './PanelButton'

export const useStyles = makeStyles((theme, props: PanelButtonProps) => {
    let backgroundColor = theme.colors.layerGrayLighter
    let color = theme.colors.textMain
    let padding = theme.spacing.lg
    if (props.variant === 'error') {
        backgroundColor = theme.colors.suspiciousBannerBg
        color = theme.colors.alertNegative
    }

    if (props.paddingStyle === 'dense') {
        padding = theme.spacing.md
    }

    return {
        buttonStyle: {
            backgroundColor,
            borderRadius: theme.spacing.lg,
            flexDirection: 'row',
            alignItems: props.description ? 'flex-start' : 'center',
            padding,
            gap: theme.spacing.md,
        },
        textStyle: {
            flexShrink: 1,
            backgroundColor: 'transparent',
            color,
        },
        descriptionStyle: {
            flexShrink: 1,
            backgroundColor: 'transparent',
            color: theme.colors.textGray,
        },
        textContainerStyle: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        titleContainerStyle: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
        },
        footerRowStyle: {
            marginTop: theme.spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'transparent',
        },
        badgeContainerStyle: {
            // Pins the badge right whether or not a learn-more link shares the
            // row, so neither case needs its own justifyContent.
            marginLeft: 'auto',
        },
        learnMoreStyle: {
            backgroundColor: 'transparent',
        },
    }
})
