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
import type { EdgeInsets } from 'react-native-safe-area-context'

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top + theme.spacing.sm,
    },
    iconBar: {
        flexGrow: 0,
        flexShrink: 0,
        paddingHorizontal: theme.spacing.lg,
    },
    iconBarSection: {
        flexDirection: 'row',
        gap: theme.spacing.lg,
    },
    accountSelectionToolbar: {
        alignSelf: 'stretch',
    },
    tabNavigator: {
        flex: 1,
        marginTop: theme.spacing.xs,
        minHeight: 0,
    },
}))
