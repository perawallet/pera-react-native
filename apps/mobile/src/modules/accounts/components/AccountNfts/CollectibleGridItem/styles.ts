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
    container: {
        flex: 1,
        margin: theme.spacing.xs,
        borderRadius: theme.borders.radiusMd,
        backgroundColor: theme.colors.layerGrayLighter,
        overflow: 'hidden',
    },
    imageContainer: {
        aspectRatio: 1,
        backgroundColor: theme.colors.layerGrayLight,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.layerGrayLight,
    },
    infoContainer: {
        padding: theme.spacing.sm,
        gap: theme.spacing.xxs,
    },
    title: {
        color: theme.colors.textPrimary,
    },
    collectionName: {
        color: theme.colors.textGray,
    },
    amountBadge: {
        position: 'absolute',
        top: theme.spacing.xs,
        right: theme.spacing.xs,
        backgroundColor: theme.colors.layerGrayDarker,
        borderRadius: theme.borders.radiusSm,
        paddingHorizontal: theme.spacing.xs,
        paddingVertical: theme.spacing.xxs,
    },
    amountBadgeText: {
        color: theme.colors.textWhite,
    },
}))
