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

// Matches PWSlideToConfirm's track so the two confirm surfaces are interchangeable.
const TRACK_HEIGHT = 56
const CENTER_ICON_SIZE = 64

type StyleProps = {
    isDisabled: boolean
}

export const useStyles = makeStyles((theme, { isDisabled }: StyleProps) => ({
    root: {
        height: TRACK_HEIGHT,
        borderRadius: theme.borderRadius.full,
        justifyContent: 'center',
        opacity: isDisabled ? 0.6 : 1,
    },
    background: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: theme.borderRadius.full,
    },
    fillLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.xl,
    },
    labelText: {
        color: theme.colors.textMain,
        width: '100%',
        textAlign: 'center',
    },
    armedLabelText: {
        color: theme.colors.buttonFloatIconMain,
        width: '100%',
        textAlign: 'center',
    },
    lottie: {
        width: CENTER_ICON_SIZE,
        height: CENTER_ICON_SIZE,
    },
}))
