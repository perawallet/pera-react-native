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

export const useStyles = makeStyles(theme => ({
    container: {
        // Bounds the scrolling body against the fixed-height sheet.
        flex: 1,
        paddingHorizontal: theme.spacing.xl,
    },
    body: {
        gap: theme.spacing.lg,
        paddingBottom: theme.spacing.xl,
    },
    title: {
        textAlign: 'left',
    },
    description: {
        textAlign: 'left',
        color: theme.colors.textGray,
    },
    loading: {
        paddingVertical: theme.spacing.xxl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorBox: {
        gap: theme.spacing.sm,
    },
    errorBody: {
        color: theme.colors.textGray,
    },
    grid: {
        flexDirection: 'row',
        padding: theme.spacing.xl,
        backgroundColor: theme.colors.layerGrayLightest,
        borderRadius: theme.borderRadius.sm,
        gap: theme.spacing.lg,
    },
    column: {
        flex: 1,
    },
    wordCell: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.xs,
        gap: theme.spacing.sm,
    },
    wordIndex: {
        ...getTypography(theme, 'mono'),
        color: theme.colors.textGray,
        minWidth: theme.spacing.xl,
        textAlign: 'right',
    },
    wordText: {
        ...getTypography(theme, 'mono'),
    },
}))
