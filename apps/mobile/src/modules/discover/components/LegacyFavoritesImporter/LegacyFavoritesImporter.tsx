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

import { WebView } from 'react-native-webview'
import { PWView } from '@components/core'
import { joinWebViewScripts } from '@modules/webview'
import { legacyFavoritesReaderScript } from '../../utils/legacyFavorites'
import { useLegacyFavoritesImporter } from './useLegacyFavoritesImporter'
import { useStyles } from './styles'

const READER_SCRIPT = joinWebViewScripts(legacyFavoritesReaderScript)

/**
 * Loads the legacy Discover origin out of sight once, to read the favorites
 * its web app kept in localStorage. Renders nothing once the import is done.
 */
export const LegacyFavoritesImporter = () => {
    const styles = useStyles()
    const importer = useLegacyFavoritesImporter()

    if (!importer.isActive) return null

    return (
        <PWView
            style={styles.host}
            pointerEvents='none'
            accessible={false}
            importantForAccessibility='no-hide-descendants'
            testID='discover_legacy_favorites_importer'
        >
            <WebView
                {...importer.webViewProps}
                injectedJavaScript={READER_SCRIPT}
            />
        </PWView>
    )
}
