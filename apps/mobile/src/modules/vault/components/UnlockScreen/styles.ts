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
import { getFontWeightVariant } from '@theme/typography'

const HEADER_IMAGE_WIDTH = 137
const HEADER_IMAGE_HEIGHT = 217

export const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        // Fixed padding (not vertical centering) so the form doesn't jump
        // when the error/lockout text appears below it.
        paddingTop: theme.spacing['5xl'] * 2,
        gap: theme.spacing.lg,
    },
    title: {
        ...getFontWeightVariant(theme, 'h2', 600),
        color: theme.colors.textMain,
        marginBottom: theme.spacing.xs,
    },
    description: {
        color: theme.colors.textGray,
        marginBottom: theme.spacing.sm,
    },
    errorText: {
        color: theme.colors.negative,
    },
    unlockButton: {
        marginTop: theme.spacing.md,
    },
    imageContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        position: 'absolute',
        top: 0,
        right: 0,
    },
    headerImage: {
        width: HEADER_IMAGE_WIDTH,
        height: HEADER_IMAGE_HEIGHT,
        resizeMode: 'contain',
    },
}))
