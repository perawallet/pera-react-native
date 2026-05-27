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

type StyleProps = {
    bottomInset: number
    titleAlign: 'left' | 'center'
    hasActions: boolean
}

export const useStyles = makeStyles(
    (theme, { bottomInset, titleAlign, hasActions }: StyleProps) => ({
        container: {
            paddingBottom: hasActions
                ? theme.spacing.lg
                : theme.spacing.lg + bottomInset,
            alignItems: 'center',
        },
        icon: {
            marginBottom: theme.spacing.lg,
        },
        title: {
            alignSelf: 'stretch',
            textAlign: titleAlign,
            paddingHorizontal: theme.spacing.lg,
        },
        message: {
            alignSelf: 'stretch',
            textAlign: 'left',
            padding: theme.spacing.xl,
            color: theme.colors.textGray,
        },
        actions: {
            width: '100%',
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: bottomInset,
            gap: theme.spacing.md,
        },
    }),
)
