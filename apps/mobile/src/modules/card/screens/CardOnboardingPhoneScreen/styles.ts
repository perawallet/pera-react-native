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
    content: {
        paddingTop: theme.spacing.xl,
        gap: theme.spacing.xl,
    },
    fields: {
        gap: theme.spacing.xs,
    },
    label: {
        color: theme.colors.textGrayLighter,
    },
    // Sets the SMS expectation; same muted token as the label.
    helper: {
        color: theme.colors.textGrayLighter,
    },
    // Top-aligned so the number's error line doesn't offset the calling code.
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.xs,
    },
    // Wide enough for the flag + a 3-4 digit dial code + the chevron (no `6xl`
    // token, so compose `5xl` + `lg`).
    callingCode: {
        width: theme.spacing['5xl'] + theme.spacing.lg,
        flexShrink: 0,
    },
    numberInput: {
        flex: 1,
    },
    // Constant-height error line so showing/clearing it never shifts layout.
    errorMessage: {
        marginTop: theme.spacing.xs,
        marginBottom: 0,
        minHeight: theme.spacing.lg,
    },
}))
