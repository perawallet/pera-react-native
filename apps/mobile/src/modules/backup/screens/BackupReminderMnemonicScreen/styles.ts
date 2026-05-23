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

export const useStyles = makeStyles(theme => ({
    root: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        paddingTop: theme.spacing.xl,
        gap: theme.spacing.lg,
    },
    title: {
        textAlign: 'left',
    },
    description: {
        textAlign: 'left',
        color: theme.colors.textGray,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: theme.spacing.md,
        padding: theme.spacing.xl,
        backgroundColor: theme.colors.layerGrayLightest,
        borderRadius: theme.borderRadius.sm,
    },
    wordCell: {
        flexBasis: '50%',
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
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorBox: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        gap: theme.spacing.sm,
    },
}))
