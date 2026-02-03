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
import { getTypography } from '@theme/typography'

export const useStyles = makeStyles(theme => {
    const bodyTypography = getTypography(theme, 'body')

    return {
        container: {
            backgroundColor: theme.colors.background,
            borderBottomWidth: theme.borders.sm,
            borderBottomColor: theme.colors.layerGrayLight,
        },
        indicator: {
            backgroundColor: theme.colors.textMain,
            height: 2,
        },
        title: {
            fontFamily: bodyTypography.fontFamily,
            fontSize: bodyTypography.fontSize,
            textTransform: 'none',
        },
        activeTitle: {
            color: theme.colors.textMain,
        },
        inactiveTitle: {
            color: theme.colors.textGray,
        },
    }
})
