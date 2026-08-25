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
    quantumNote: {
        color: theme.colors.textGray,
        marginBottom: theme.spacing.md,
    },
    wordContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.lg,
    },
    column: {
        width: '47%',
    },
    inputContainerRow: {
        marginTop: theme.spacing.sm,
        flexDirection: 'row',
        gap: theme.spacing.sm,
        alignItems: 'center',
    },
    focusedInputContainerRow: {
        marginTop: theme.spacing.sm,
        flexDirection: 'row',
        gap: theme.spacing.sm,
        alignItems: 'center',
    },
    label: {
        color: theme.colors.textGray,
    },
    focusedLabel: {
        color: theme.colors.textMain,
    },
    inputWrapper: {
        flex: 1,
    },
    inputOuterContainer: {
        flexShrink: 1,
    },
    inputContainer: {
        backgroundColor: theme.colors.background,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.layerGray,
        flexShrink: 1,
    },
    focusedInputContainer: {
        backgroundColor: theme.colors.background,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.textMain,
        flexShrink: 1,
    },
    invalidInputContainer: {
        backgroundColor: theme.colors.background,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.negative,
        flexShrink: 1,
    },
    input: {
        flexShrink: 1,
        backgroundColor: 'transparent',
    },
}))
