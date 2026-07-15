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
    scrollContent: {
        gap: theme.spacing.lg,
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
    labelFocused: {
        width: theme.spacing.xl,
        color: theme.colors.textMain,
    },
    inputWrap: {
        flex: 1,
    },
    inputOuter: {
        paddingHorizontal: 0,
        flexShrink: 1,
    },
    inputContainer: {
        backgroundColor: theme.colors.background,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.layerGray,
        flexShrink: 1,
    },
    inputContainerFocused: {
        backgroundColor: theme.colors.background,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.textMain,
        flexShrink: 1,
    },
    input: {
        flexShrink: 1,
        backgroundColor: 'transparent',
    },
}))
