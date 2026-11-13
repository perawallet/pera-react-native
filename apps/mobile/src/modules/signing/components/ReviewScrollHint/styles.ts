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

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: scroll hint chip size
const CHIP_SIZE = 32

export const useStyles = makeStyles(theme => ({
    // Overlays the bottom of the body, so showing and hiding it never moves the review.
    container: {
        position: 'absolute',
        bottom: '100%',
        alignSelf: 'center',
        paddingBottom: theme.spacing.sm,
    },
    chip: {
        width: CHIP_SIZE,
        height: CHIP_SIZE,
        borderRadius: theme.borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        ...theme.shadows.md,
    },
    ring: {
        position: 'absolute',
        width: CHIP_SIZE,
        height: CHIP_SIZE,
        borderRadius: theme.borderRadius.full,
        borderWidth: theme.borders.md,
        borderColor: theme.colors.linkPrimary,
    },
}))
