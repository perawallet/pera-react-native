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

export const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
    },
    body: {
        color: theme.colors.textGray,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.md,
    },
    wordCell: {
        flexBasis: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: 12,
        gap: theme.spacing.sm,
    },
    wordIndex: {
        color: theme.colors.textGray,
        minWidth: 20,
    },
    ctaRow: {
        marginTop: 'auto',
    },
    errorBox: {
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
    },
}))
