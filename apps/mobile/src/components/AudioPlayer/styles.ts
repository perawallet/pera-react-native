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
import type { ScaledSize } from 'react-native'

const TIME_LABEL_MIN_WIDTH = 44

export const useStyles = makeStyles(
    (theme, { width, height }: Pick<ScaledSize, 'width' | 'height'>) => ({
        container: {
            width,
            height,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xl,
            paddingHorizontal: theme.spacing.lg,
        },
        poster: {
            width: '100%',
            aspectRatio: 1,
            borderRadius: theme.borderRadius.sm,
        },
        posterPlaceholder: {
            width: '100%',
            aspectRatio: 1,
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.layerGrayLighter,
            alignItems: 'center',
            justifyContent: 'center',
        },
        controls: {
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
        },
        timeLabel: {
            color: theme.colors.white,
            minWidth: TIME_LABEL_MIN_WIDTH,
        },
        progressTrack: {
            flex: 1,
            height: theme.spacing.xs,
            borderRadius: theme.borders.md,
            backgroundColor: theme.colors.layerGrayLightest,
            overflow: 'hidden',
        },
        progressFill: {
            height: '100%',
            backgroundColor: theme.colors.white,
        },
    }),
)
