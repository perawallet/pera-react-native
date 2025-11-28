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
import { PWWebViewProps } from './PWWebView'

export const useStyles = makeStyles((theme, props: PWWebViewProps) => {
    return {
        flex: {
            flex: 1,
            marginBottom: theme.spacing.xl * 2,
        },
        webview: {
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            flexGrow: 1,
            backgroundColor: theme.colors.background,
        },
        loading: {
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.background,
        },
        container: {
            backgroundColor: theme.colors.background,
            flexGrow: 1,
        },
        titleBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: theme.spacing.md,
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
        url: {
            color: theme.colors.textGray,
            fontSize: theme.spacing.md,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            flexWrap: 'nowrap',
            flexShrink: 1,
        },
        footerBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            backgroundColor: theme.colors.background,
        }
    }
})
