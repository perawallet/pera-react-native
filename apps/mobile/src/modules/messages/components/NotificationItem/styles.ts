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

export const useStyles = makeStyles(theme => {
    const imageSize = theme.spacing.xxl
    return {
        container: {
            flexDirection: 'row',
            gap: theme.spacing.md,
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            // Rows are separated only by a hairline divider; without vertical
            // padding they render flush against it (same trap as InboxItem).
            paddingVertical: theme.spacing.md,
        },
        messageBox: {
            flexShrink: 1,
            overflow: 'hidden',
        },
        messageText: {
            flexShrink: 1,
            flexWrap: 'wrap',
        },
        timeText: {
            color: theme.colors.textGray,
        },
        iconContainerNoBorder: {
            width: imageSize,
            height: imageSize,
            borderRadius: theme.spacing.xl,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: theme.spacing.xs,
        },
        iconContainer: {
            width: imageSize,
            height: imageSize,
            borderRadius: theme.spacing.xl,
            borderWidth: theme.borders.sm,
            borderColor: theme.colors.layerGrayLighter,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: theme.spacing.xs,
        },
        image: {
            aspectRatio: 1,
            width: '100%',
            borderRadius: theme.spacing.sm,
        },
        imageCircle: {
            aspectRatio: 1,
            width: '100%',
            borderRadius: imageSize / 2,
            overflow: 'hidden',
        },
        unreadIndicatorWrapper: {
            height: imageSize,
            marginTop: theme.spacing.xs,
        },
    }
})
