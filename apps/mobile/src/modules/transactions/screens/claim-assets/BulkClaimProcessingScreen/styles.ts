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

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: matches the single-claim processing spinner circle
const SPINNER_CIRCLE_SIZE = 60

export const useStyles = makeStyles(theme => ({
    header: {
        alignItems: 'center',
        paddingTop: theme.spacing['3xl'],
        paddingBottom: theme.spacing.xl,
    },
    spinnerCircle: {
        width: SPINNER_CIRCLE_SIZE,
        height: SPINNER_CIRCLE_SIZE,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.buttonHelperBg,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    animation: {
        width: theme.spacing['3xl'],
        height: theme.spacing['3xl'],
    },
    title: {
        marginTop: theme.spacing.xl,
    },
    subtitle: {
        marginTop: theme.spacing.sm,
        color: theme.colors.textGray,
        textAlign: 'center',
    },
    doneButton: {
        marginHorizontal: theme.spacing.xl,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: theme.borders.sm,
        borderBottomColor: theme.colors.layerGrayLighter,
    },
    statusIcon: {
        width: theme.spacing.xl,
        alignItems: 'center',
    },
    name: {
        flex: 1,
    },
    status: {
        color: theme.colors.textGray,
    },
}))
