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

export const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
    },
    imageContainer: {
        aspectRatio: 1,
        borderRadius: theme.borderRadius.sm,
        overflow: 'hidden',
        backgroundColor: theme.colors.layerGrayLighter,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.layerGrayLighter,
    },
    infoContainer: {
        paddingTop: theme.spacing.sm,
        alignItems: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    title: {
        flexShrink: 1,
        color: theme.colors.textMain,
        marginHorizontal: theme.spacing.sm,
        textAlign: 'center',
    },
    collectionName: {
        color: theme.colors.textGray,
    },
    amountBadge: {
        position: 'absolute',
        top: theme.spacing.sm,
        right: theme.spacing.sm,
        backgroundColor: theme.colors.nftIconBg,
        borderRadius: theme.borderRadius.xs,
        paddingHorizontal: theme.spacing.sm,
    },
    amountBadgeText: {
        color: theme.colors.textWhite,
    },
}))
