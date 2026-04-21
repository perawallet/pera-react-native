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
import { fontFamilies } from '@constants/fonts'

export const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    body: {
        color: theme.colors.textGray,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.md,
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.md,
    },
    wordCell: {
        flexBasis: '46%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.xs,
        gap: theme.spacing.sm,
    },
    wordIndex: {
        fontFamily: fontFamilies.DMMONO[400],
        color: theme.colors.textGray,
        minWidth: theme.spacing.xl,
    },
    wordText: {
        fontFamily: fontFamilies.DMMONO[400],
        color: theme.colors.textMain,
    },
    ctaRow: {
        marginTop: 'auto',
    },
    errorBox: {
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
    },
}))
