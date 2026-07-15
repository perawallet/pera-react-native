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

type OnrampStatusVariant =
    | 'positive'
    | 'warning'
    | 'negative'
    | 'neutral'
    | 'main'

type StyleProps = { variant: OnrampStatusVariant }

export const useStyles = makeStyles((theme, { variant }: StyleProps) => {
    const labelColor = {
        positive: theme.colors.positive,
        warning: theme.colors.warningText,
        negative: theme.colors.negative,
        neutral: theme.colors.textGray,
        main: theme.colors.textMain,
    }[variant]

    return {
        container: {
            alignSelf: 'flex-start',
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.sm,
            borderRadius: theme.borderRadius.full,
            backgroundColor: theme.colors.layerGrayLightest,
        },
        label: {
            color: labelColor,
        },
    }
})
