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
    fill: {
        flex: 1,
    },
    gap: {
        gap: theme.spacing.md,
    },
    // Visual gap below the last row. In a bottom sheet the safe-area inset is
    // owned by PWBottomSheet's innerContainer; on screens it comes from PWScreen.
    verticalContentContainer: {
        flexGrow: 1,
        paddingBottom: theme.spacing.xl,
    },
}))
