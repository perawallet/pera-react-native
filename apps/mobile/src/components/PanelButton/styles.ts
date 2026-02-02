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
import { PanelButtonProps } from './PanelButton'

export const useStyles = makeStyles((theme, props: PanelButtonProps) => {
    let backgroundColor = theme.colors.layerGrayLighter
    let color = theme.colors.textMain
    if (props.variant === 'error') {
        backgroundColor = theme.colors.asaSuspiciousBg
        color = theme.colors.error
    }
    return {
        buttonStyle: {
            backgroundColor,
            borderRadius: theme.spacing.lg,
            justifyContent: 'space-between',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.lg,
        },
        titleStyle: {
            flexShrink: 1,
            backgroundColor: 'transparent',
            gap: theme.spacing.md,
            flexDirection: 'row',
        },
        textStyle: {
            flexShrink: 1,
            backgroundColor: 'transparent',
            color,
            verticalAlign: 'middle',
        },
        descriptionStyle: {
            flexShrink: 1,
            backgroundColor: 'transparent',
            lineHeight: theme.spacing.xl,
        },
        textContainerStyle: {
            flexShrink: 1,
            backgroundColor: 'transparent',
            gap: theme.spacing.sm,
            padding: theme.spacing.lg,
        },
    }
})
