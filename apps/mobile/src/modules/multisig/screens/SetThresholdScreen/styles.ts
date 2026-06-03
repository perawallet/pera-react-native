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
    summaryContainer: {
        flexGrow: 1,
        gap: theme.spacing.xl,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    label: {
        color: theme.colors.textMain,
        flexShrink: 1,
    },
    countGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    // Matches ThresholdStepper's + button width so the count column-aligns
    // with the threshold value below it.
    buttonSpacer: {
        width: theme.spacing['3xl'],
        marginLeft: theme.spacing.xs,
    },
}))
