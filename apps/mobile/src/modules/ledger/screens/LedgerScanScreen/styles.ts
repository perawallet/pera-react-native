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

// Preserves the source aspect ratio of the Ledger searching animation
// (~137×39) while rendering it at a legible size in the header.
const ANIMATION_WIDTH = 160
const ANIMATION_HEIGHT = 46

export const useStyles = makeStyles(theme => ({
    headerAnimation: {
        width: ANIMATION_WIDTH,
        height: ANIMATION_HEIGHT,
        marginBottom: theme.spacing.md,
    },
    listContent: {
        paddingTop: theme.spacing.md,
    },
    errorContainer: {
        paddingTop: theme.spacing.xl,
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    errorText: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
}))
