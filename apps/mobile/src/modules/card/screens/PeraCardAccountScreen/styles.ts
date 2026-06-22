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
import { type EdgeInsets } from 'react-native-safe-area-context'

// Small card-art thumbnail in the header (fixed card-ratio dims — no runtime
// aspect-ratio derivation, per the project's image-sizing convention).
const CARD_THUMB_WIDTH = 48
const CARD_THUMB_HEIGHT = 30

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top + theme.spacing.sm,
    },
    tabNavigator: {
        flex: 1,
        marginTop: theme.spacing.xs,
        minHeight: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        flex: 1,
        minWidth: 0,
    },
    cardThumb: {
        width: CARD_THUMB_WIDTH,
        height: CARD_THUMB_HEIGHT,
        borderRadius: theme.spacing.xs,
        // PWImage puts `style` on an outer View, so clip the inner image to
        // make the rounded corners actually show.
        overflow: 'hidden',
    },
    headerTitleBlock: {
        flex: 1,
        minWidth: 0,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    headerSubtitle: {
        color: theme.colors.textGray,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
    },
}))
