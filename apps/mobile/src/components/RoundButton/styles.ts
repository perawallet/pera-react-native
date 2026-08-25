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

export const useStyles = makeStyles(theme => {
    return {
        container: {
            alignItems: 'center',
            minWidth: 0,
            flexShrink: 0,
        },
        buttonSlot: {
            marginBottom: theme.spacing.sm,
        },
        badge: {
            position: 'absolute',
            top: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing.xxs,
            backgroundColor: theme.colors.buttonSquareBg,
            borderWidth: theme.borders.lg,
            borderColor: theme.colors.background,
            borderRadius: theme.borderRadius.full,
        },
        // The badge stays crisp while the action it annotates dims.
        dimmed: {
            opacity: 0.5,
        },
        titleStyle: {
            textAlign: 'center',
            width: '100%',
            minWidth: 0,
        },
    }
})
