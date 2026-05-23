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
        gap: theme.spacing.lg,
        width: '100%',
        minWidth: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.md,
        minWidth: 0,
    },
    titleContainer: {
        flex: 1,
        minWidth: 0,
        gap: theme.spacing.xxs,
    },
    title: {
        flexShrink: 1,
        minWidth: 0,
    },
    titleQualifier: {
        color: theme.colors.textGray,
        flexShrink: 1,
        minWidth: 0,
    },
    description: {
        color: theme.colors.textGray,
        width: '100%',
    },
    learnMoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minWidth: 0,
    },
    learnMoreText: {
        flex: 1,
        minWidth: 0,
    },
}))
