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

// Web-only override: the native styles size this hero for a full phone
// screen (aspectRatio 327/222 at a ~360-420px sheet width comes out
// ~245-285px tall), which doesn't leave room for the rest of the intro
// inside the popup's 360x600 viewport (or the ~420px-wide expanded-tab
// card, which is no taller in practice). OnrampIntroductionContent.tsx
// sets resizeMode='contain' on the image, so capping height here only
// shrinks the letterboxed image, never crops it.
export const useStyles = makeStyles(theme => ({
    scrollContent: {
        flexGrow: 1,
    },
    heroImage: {
        width: '100%',
        aspectRatio: 327 / 222,
        // lanekeep-ignore-next-line pera/no-numeric-sizes reason: bespoke web popup height cap for the hero illustration, not a spacing value; no theme token matches
        maxHeight: 120,
    },
    contentSection: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.xl,
        gap: theme.spacing.md,
        width: '100%',
        minWidth: 0,
    },
    header: {
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    // PWChip defaults to alignSelf:'flex-start'; override so it centers under
    // the (center-aligned) header.
    newChip: {
        alignSelf: 'center',
    },
    title: {
        color: theme.colors.textMain,
        textAlign: 'center',
    },
    startButton: {
        marginTop: theme.spacing.xs,
    },
}))
