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
import { type EdgeInsets } from 'react-native-safe-area-context'
import { getTypography } from '@theme/typography'

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top,
        zIndex: theme.zIndex.max,
        alignItems: 'center',
    },
    stack: {
        marginTop: theme.spacing.xs,
        alignItems: 'center',
    },
    banner: {
        backgroundColor: theme.colors.layerGray,
        borderRadius: theme.borderRadius.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerReconnected: {
        backgroundColor: theme.colors.positive,
    },
    text: {
        ...getTypography(theme, 'caption'),
        color: theme.colors.textGray,
    },
    textReconnected: {
        color: theme.colors.textMain,
    },
    explanation: {
        backgroundColor: theme.colors.layerGray,
        borderRadius: theme.borderRadius.md,
        marginTop: theme.spacing.xs,
        marginHorizontal: theme.spacing.xl,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
    },
    explanationText: {
        ...getTypography(theme, 'caption'),
        color: theme.colors.textGray,
        textAlign: 'center',
    },
}))
