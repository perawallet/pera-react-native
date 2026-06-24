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

export const useStyles = makeStyles(theme => {
    const secondaryText = {
        color: theme.colors.textGray,
        lineHeight: theme.spacing.lg,
    }
    return {
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: theme.spacing.lg,
            borderWidth: theme.borders.sm,
            borderColor: theme.colors.layerGray,
        },
        content: {
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 0,
        },
        rightContent: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
        },
        externalPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xxs,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.borderRadius.sm,
        },
        externalPillText: {
            color: theme.colors.textMain,
            maxWidth: theme.spacing['3xl'],
        },
        primaryText: {
            color: theme.colors.textMain,
        },
        secondaryText,
    }
})
