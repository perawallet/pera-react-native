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
    header: {
        gap: theme.spacing.lg,
        width: '100%',
        minWidth: 0,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        minWidth: 0,
        gap: theme.spacing.md,
    },
    headerLabelContainer: {
        flex: 1,
        minWidth: 0,
    },
    accountItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.lg,
        width: '100%',
        minWidth: 0,
        gap: theme.spacing.md,
    },
    accountInfo: {
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
    },
    accountDisplay: {
        flex: 1,
        minWidth: 0,
        width: '100%',
    },
    switchContainer: {
        flexShrink: 0,
    },
    grayText: {
        color: theme.colors.textGray,
    },
    mainText: {
        color: theme.colors.textMain,
    },
}))
