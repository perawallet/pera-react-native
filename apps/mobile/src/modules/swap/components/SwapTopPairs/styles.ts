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
        gap: theme.spacing.sm,
        marginTop: theme.spacing.lg,
        width: '100%',
        minWidth: 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        minWidth: 0,
    },
    headerTitle: {
        color: theme.colors.textMain,
        flex: 1,
        minWidth: 0,
    },
    headerLabel: {
        color: theme.colors.textGray,
        flexShrink: 1,
        minWidth: 0,
        maxWidth: '45%',
        textAlign: 'right',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
    },
    itemIndex: {
        color: theme.colors.textGray,
        minWidth: theme.spacing.md,
    },
    itemLabelContainer: {
        flex: 1,
        minWidth: 0,
    },
    itemVolume: {
        color: theme.colors.textGray,
        textAlign: 'right',
        flexShrink: 0,
    },
    skeletonRow: {
        height: theme.spacing['3xl'],
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.spacing.xs,
    },
    errorText: {
        color: theme.colors.textGray,
        textAlign: 'center',
        paddingVertical: theme.spacing.md,
    },
}))
