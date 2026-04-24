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

const ICON_SIZE = 40
const ACTION_SIZE = 36

export const useStyles = makeStyles(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        minHeight: ASSET_LIST_ITEM_MIN_HEIGHT,
    },
    assetIcon: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: ICON_SIZE / 2,
        backgroundColor: theme.colors.layerGrayLighter,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    collectibleIcon: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: theme.borderRadius.sm,
        backgroundColor: theme.colors.layerGrayLighter,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    infoContainer: {
        flex: 1,
        marginLeft: theme.spacing.sm,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    titleText: {
        flexShrink: 1,
    },
    verificationIcon: {
        marginLeft: theme.spacing.xs,
    },
    subtitle: {
        color: theme.colors.textGray,
    },
    actionButton: {
        width: ACTION_SIZE,
        height: ACTION_SIZE,
        borderRadius: ACTION_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.layerGrayLighter,
        marginLeft: theme.spacing.sm,
    },
    separator: {
        height: theme.borders.sm,
        backgroundColor: theme.colors.layerGrayLighter,
        marginLeft: ICON_SIZE + theme.spacing.sm + theme.spacing.lg,
    },
}))
