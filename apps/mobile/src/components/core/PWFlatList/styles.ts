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

type StyleProps = {
    bottomInset: number
}

export const useStyles = makeStyles((theme, { bottomInset }: StyleProps) => ({
    content: {
        paddingVertical: theme.spacing.xl,
    },
    // In-sheet lists scroll edge-to-edge, so the content owns the bottom
    // safe-area inset (the hosting sheets use autoCreateContainer:false, which
    // means no inner-container inset). Appended last so it wins over a caller's
    // contentContainerStyle paddingBottom.
    sheetBottomInset: {
        paddingBottom: theme.spacing.xl + bottomInset,
    },
    itemSeparator: {
        marginVertical: theme.spacing.md,
        height: theme.borders.sm,
        backgroundColor: theme.colors.layerGrayLighter,
        // Inset to align with row content past the standard leading icon
        // (icon width xxl + row gap lg), matching AccountAssetList's divider.
        marginLeft: theme.spacing.xxl + theme.spacing.lg,
    },
    cardSeparator: {
        height: theme.spacing.md,
    },
    // Lets a ListEmptyComponent fill the list height so it can center itself,
    // applied only while the list is actually empty (no effect on content).
    fillEmpty: {
        flexGrow: 1,
    },
}))
