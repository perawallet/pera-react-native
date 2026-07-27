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
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    qrContainer: {
        alignItems: 'center',
    },
    addressContainer: {
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        marginTop: theme.spacing.xxl,
    },
    buttonContainer: {
        gap: theme.spacing.md,
    },
    // The address is one long unbroken run of characters (no spaces), so it
    // only wraps if something in its ancestor chain has a definite width to
    // wrap against. Yoga (native) always resolves that width even under
    // `addressContainer`'s alignItems: 'center'; CSS flexbox (react-native-web)
    // instead sizes a centered, unconstrained flex child to its content's
    // natural (unwrapped) width, so the address renders on one line and
    // overflows the sheet instead of wrapping. `alignSelf: 'stretch'` gives
    // the touchable a real width on both platforms — a no-op for native
    // layout (Yoga already wrapped correctly) beyond a slightly larger,
    // arguably more tappable copy target, and the fix on web.
    addressButton: {
        alignSelf: 'stretch',
    },
    address: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
}))
