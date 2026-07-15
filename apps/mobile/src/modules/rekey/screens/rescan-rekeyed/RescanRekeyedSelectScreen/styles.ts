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

export const useStyles = makeStyles(theme => ({
    statusContainer: {
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
    },
    emptyView: {
        paddingHorizontal: theme.spacing.xl,
    },
    statusText: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
    scrollContent: {
        gap: theme.spacing.xl,
    },
    section: {
        gap: theme.spacing.md,
    },
    sectionLabel: {
        color: theme.colors.textGray,
        textTransform: 'uppercase',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectAllText: {
        color: theme.colors.positive,
        marginRight: theme.spacing.xs,
    },
    checkboxContainer: {
        padding: 0,
        margin: 0,
        marginLeft: 0,
        marginRight: 0,
        backgroundColor: 'transparent',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderWidth: theme.borders.md,
        borderColor: 'transparent',
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.layerGrayLighter,
    },
    rowDisabled: {
        opacity: 0.6,
    },
    disabledText: {
        color: theme.colors.textGray,
    },
    footer: {
        gap: theme.spacing.sm,
    },
    cta: {
        paddingVertical: theme.spacing.lg,
    },
}))
