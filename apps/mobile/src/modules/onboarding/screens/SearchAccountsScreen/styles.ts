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

// Sizes pulled from Figma node 110459:26125.
const DOT_SIZE = 3
const DOT_GAP = 12

export const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: theme.spacing.xxl,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: theme.spacing.lg,
        gap: DOT_GAP,
    },
    dot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
    },
    dot1: {
        backgroundColor: theme.colors.layerGray,
    },
    dot2: {
        backgroundColor: theme.colors.textGrayLighter,
    },
    dot3: {
        backgroundColor: theme.colors.textGray,
    },
    dot4: {
        backgroundColor: theme.colors.textMain,
    },
    title: {
        textAlign: 'center',
    },
}))
