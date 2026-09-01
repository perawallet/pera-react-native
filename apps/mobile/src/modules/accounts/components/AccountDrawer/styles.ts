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

type StyleProps = {
    topInset: number
}

export const useStyles = makeStyles((theme, { topInset }: StyleProps) => ({
    // The drawer panel is drawn edge to edge, so unlike the bottom-sheet host
    // this content owns the top inset itself. No bottom inset: PWFlatList
    // already ends its vertical content with spacing.xl, and adding the
    // safe-area on top of that left a visible band of dead space.
    container: {
        flex: 1,
        paddingTop: topInset,
        paddingHorizontal: theme.spacing.xl,
        minWidth: 0,
        overflow: 'hidden',
    },
    // Only rendered when there's a search trigger to hold.
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
    },
    searchTrigger: {
        flex: 1,
    },
}))
