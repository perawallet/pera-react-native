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
import { DEFAULT_SWIPE_ACTION_WIDTH } from '@components/core'

export const useStyles = makeStyles(theme => ({
    itemContainer: {
        marginVertical: theme.spacing.lg,
    },
    swipeableContent: {
        backgroundColor: theme.colors.background,
    },
    swipeAction: {
        backgroundColor: theme.colors.negative,
        justifyContent: 'center',
        alignItems: 'center',
        width: DEFAULT_SWIPE_ACTION_WIDTH,
        borderRadius: theme.spacing.sm,
        marginVertical: theme.spacing.lg,
        marginLeft: theme.spacing.lg,
    },
}))
