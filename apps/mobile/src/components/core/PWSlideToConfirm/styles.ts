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

export const TRACK_HEIGHT = 56
export const THUMB_SIZE = 48
export const TRACK_INSET = 4

type StyleProps = {
    isDisabled: boolean
}

export const useStyles = makeStyles((theme, { isDisabled }: StyleProps) => ({
    track: {
        height: TRACK_HEIGHT,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.layerGrayLighter,
        justifyContent: 'center',
        paddingHorizontal: TRACK_INSET,
        opacity: isDisabled ? 0.6 : 1,
        overflow: 'hidden',
    },
    fill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: theme.colors.buttonPrimaryBg,
        borderRadius: theme.borderRadius.full,
    },
    label: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelText: {
        color: theme.colors.textGray,
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.buttonPrimaryBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingPill: {
        height: TRACK_HEIGHT,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.buttonPrimaryBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmedPill: {
        height: TRACK_HEIGHT,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.positive,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lottie: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
    },
}))
