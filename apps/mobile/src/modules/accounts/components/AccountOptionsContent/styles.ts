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
    accountInfoContainer: {
        paddingHorizontal: theme.spacing.xl,
        marginBottom: theme.spacing.lg,
    },
    divider: {
        marginVertical: theme.spacing.sm,
        marginHorizontal: theme.spacing.xl,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: theme.spacing['3xl'] + theme.spacing.lg,
        paddingHorizontal: theme.spacing.xl,
        gap: theme.spacing.lg,
        minWidth: 0,
    },
    optionRowDisabled: {
        opacity: 0.5,
    },
    optionTextContainer: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'column',
    },
    optionSubtitle: {
        color: theme.colors.textGray,
    },
    dangerText: {
        color: theme.colors.negative,
    },
}))
