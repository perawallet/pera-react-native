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
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: theme.spacing.xl,
    },
    heroIcon: {
        alignItems: 'center',
        marginTop: theme.spacing.lg,
        marginBottom: theme.spacing.lg,
    },
    title: {
        textAlign: 'center',
        marginBottom: theme.spacing.md,
    },
    description: {
        textAlign: 'center',
        color: theme.colors.textGray,
        marginBottom: theme.spacing.xl,
    },
    cardList: {
        gap: theme.spacing.md,
    },
    footer: {
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.lg,
        backgroundColor: theme.colors.background,
    },
}))
