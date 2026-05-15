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
import { EdgeInsets } from 'react-native-safe-area-context'

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    root: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        gap: theme.spacing.lg,
    },
    description: {
        color: theme.colors.textGray,
    },
    columns: {
        flexDirection: 'row',
        gap: theme.spacing.md,
    },
    column: {
        flex: 1,
        gap: theme.spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    label: {
        width: theme.spacing.xl,
        color: theme.colors.textGray,
    },
    inputWrap: {
        flex: 1,
    },
    inputOuter: {
        paddingHorizontal: 0,
    },
    inputContainer: {
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.layerGrayLighter,
    },
    inputContainerFocused: {
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.textMain,
    },
    suggestionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
    },
    suggestionPill: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.md,
    },
    footer: {
        padding: theme.spacing.xl,
        paddingBottom: theme.spacing.xxl + insets.bottom,
    },
}))
