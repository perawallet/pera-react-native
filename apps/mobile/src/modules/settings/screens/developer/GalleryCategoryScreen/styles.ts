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
    sectionHeader: {
        color: theme.colors.textGray,
        marginTop: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.lg,
        borderRadius: theme.borderRadius.sm,
    },
    rowGood: {
        backgroundColor: theme.colors.positiveLighter,
    },
    rowBroken: {
        backgroundColor: theme.colors.negativeLighter,
    },
    labelArea: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
    },
    switchWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: theme.colors.textMain,
        flexShrink: 1,
    },
}))
