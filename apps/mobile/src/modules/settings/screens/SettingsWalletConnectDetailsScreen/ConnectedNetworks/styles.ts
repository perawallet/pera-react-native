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
import { getTypography } from '@theme/typography'

export const useStyles = makeStyles(theme => {
    const mainnetText = {
        ...getTypography(theme, 'caption'),
        color: theme.colors.positive,
        textTransform: 'uppercase' as const,
    }
    const testnetText = {
        ...getTypography(theme, 'caption'),
        color: theme.colors.testnetBg,
        textTransform: 'uppercase' as const,
    }
    const otherNetworkText = {
        ...getTypography(theme, 'caption'),
        color: theme.colors.textGray,
        textTransform: 'uppercase' as const,
    }
    return {
        networkContainer: {
            alignItems: 'center',
            gap: theme.spacing.xs,
        },
        networkItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
        },
        mainnetText,
        testnetText,
        otherNetworkText,
    }
})
