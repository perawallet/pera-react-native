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
import { getFontWeightVariant } from '@theme/typography'

export const useStyles = makeStyles(theme => ({
    container: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xl,
    },
    title: {
        ...getFontWeightVariant(theme, 'h3', 600),
        color: theme.colors.textMain,
        textAlign: 'center',
    },
    rpId: {
        color: theme.colors.textMain,
        textAlign: 'center',
    },
    userName: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
    error: {
        color: theme.colors.negative,
        textAlign: 'center',
    },
    buttonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.lg,
    },
    declineButton: {
        flexGrow: 1,
        flexBasis: 0,
    },
    approveButton: {
        flexGrow: 1,
        flexBasis: 0,
    },
}))
