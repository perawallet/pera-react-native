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

// ONLY the verified-requester row lives here. Everything this screen shares
// with mobile's ConnectionView — header, permissions panel, account rows,
// footer buttons — comes from that component's own stylesheet
// (@modules/walletconnect/components/ConnectionView/styles), imported rather
// than copied, so the two cannot drift on spacing or colour.
//
// The requester row has no counterpart there: mobile pairs by QR or deeplink,
// so it has no browser-verified requesting tab to attribute. These values match
// EnableRequestScreen's, which is where this row was introduced.
import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    // Column, not row: normally the badge alone sits centred under the dApp
    // url, and in the mismatch case the origin line stacks above it. Centring
    // is what makes the badge read as qualifying the url directly above.
    verifiedRow: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    // Distinct from the peer-asserted url above: this is the browser-verified
    // requester. Uses `textMain`, NOT `verifiedBannerContent` — at `caption`
    // (11px) that colour only clears 3.82:1 against `theme.colors.background`
    // in light mode, below WCAG AA's 4.5:1 for that size. It stays reserved for
    // the badge below, whose icon+label pairing carries the meaning.
    requesterOrigin: {
        color: theme.colors.textMain,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    verifiedBadgeText: {
        color: theme.colors.verifiedBannerContent,
    },
    // Also has no mobile counterpart: mobile's approve-delivery failure is a
    // toast over a sheet that stays open for an in-place retry, whereas this
    // window has lost the service worker's pending entry and can only tell the
    // user to start the request again from the site.
    deliveryError: {
        color: theme.colors.negative,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.md,
    },
}))
