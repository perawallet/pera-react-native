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

export const useStyles = makeStyles(theme => {
    const url = {
        color: theme.colors.textGray,
        fontSize: theme.spacing.md,
        textOverflow: 'ellipsis' as const,
        overflow: 'hidden' as const,
        flexWrap: 'nowrap' as const,
        flexShrink: 1,
    }
    return {
        flex: {
            flex: 1,
        },
        // The webview fills the scroll area — opt out of PWScrollView's
        // default bottom padding so there's no gap below it.
        scrollContent: {
            flex: 1,
            paddingBottom: 0,
        },
        webview: {
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            flex: 1,
            flexGrow: 1,
            backgroundColor: theme.colors.background,
        },
        container: {
            backgroundColor: theme.colors.background,
            flex: 1,
        },
        titleBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: theme.spacing.lg,
            backgroundColor: theme.colors.background,
        },
        titleBarTextContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 1,
        },
        titleIconContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing.md,
            backgroundColor: theme.colors.background,
        },
        title: {
            color: theme.colors.textMain,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flexWrap: 'nowrap',
            flexShrink: 1,
            textAlign: 'center',
        },
        url,
        footerBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            backgroundColor: theme.colors.background,
        },
        absoluteFill: {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
        },
    }
})
