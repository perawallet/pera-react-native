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
import { ASSET_LIST_ITEM_MIN_HEIGHT } from '@constants/ui'

const ACTION_SIZE = 36

export const useStyles = makeStyles(theme => ({
    container: {
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        minHeight: ASSET_LIST_ITEM_MIN_HEIGHT,
    },
    actionButton: {
        width: ACTION_SIZE,
        height: ACTION_SIZE,
        borderRadius: ACTION_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.layerGrayLighter,
    },
    separator: {
        height: theme.borders.sm,
        backgroundColor: theme.colors.layerGrayLighter,
        // Align under the text: row left-padding + AssetIcon 'xl' (3xl) + itemContainer gap (lg)
        marginLeft: theme.spacing.lg + theme.spacing['3xl'] + theme.spacing.lg,
    },
}))
