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

export const useStyles = makeStyles((theme) => {
    return {
        layout: {
            flex: 1,
            padding: 0,
            margin: 0,
        },
        mainContainer: {
            backgroundColor: theme.colors.background,
            color: theme.colors.white,
            flexDirection: 'column',
            paddingHorizontal: theme.spacing.xl,
        },
        headerContainer: {
            flexDirection: 'row',
            marginBottom: theme.spacing.lg * 3,
            justifyContent: 'space-between',
            borderWidth: 0,
        },
        headerImage: {
            width: 172,
            borderWidth: 0,
        },
        headerTitle: {
            paddingTop: theme.spacing.xl,
            paddingStart: theme.spacing.lg,
            borderWidth: 0,
            verticalAlign: 'bottom',
        },
        buttonTitle: {
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.sm,
            color: theme.colors.textGray,
        },
        overlayBackdrop: {
            backgroundColor: 'rgba(52, 52, 52, 0.8)',
        },
        overlay: {
            padding: theme.spacing.xl,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.layerGray,
            borderRadius: theme.spacing.lg,
            gap: theme.spacing.lg,
        },
    }
})
