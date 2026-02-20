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
        paddingHorizontal: theme.spacing.md,
    },
    content: {
        flex: 1,
        paddingTop: theme.spacing.xl,
    },
    iconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.lg,
    },
    title: {
        textAlign: 'center',
        marginBottom: theme.spacing.lg,
    },
    body: {
        color: theme.colors.textGray,
        marginBottom: theme.spacing.md,
    },
    sectionTitle: {
        marginTop: theme.spacing.xl,
        marginBottom: theme.spacing.lg,
    },
    stepRow: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
    },
    stepNumber: {
        color: theme.colors.textGrayLighter,
    },
    stepText: {
        flex: 1,
    },
    footer: {
        paddingBottom: theme.spacing.xl,
        gap: theme.spacing.md,
    },
}))
