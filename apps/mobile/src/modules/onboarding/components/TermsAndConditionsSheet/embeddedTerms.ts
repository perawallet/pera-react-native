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

import { resolveWebviewLanguage } from '@modules/webview'
import en from './embedded-terms.json'
import de from './embedded-terms.de.json'
import es from './embedded-terms.es.json'
import fr from './embedded-terms.fr.json'
import ptBR from './embedded-terms.pt-BR.json'
import tr from './embedded-terms.tr.json'

export type EmbeddedTerms = { version: string; html: string }

/**
 * Bundled copies of the terms, keyed by app locale tag. Every entry must carry
 * the same `version` (the embeddedTerms spec enforces it): a mismatch would
 * silently send users of that locale to the remote page instead.
 */
export const EMBEDDED_TERMS: Readonly<Record<string, EmbeddedTerms>> = {
    en,
    de,
    es,
    fr,
    tr,
    'pt-BR': ptBR,
}

export const getEmbeddedTerms = (appLocale?: string | null): EmbeddedTerms =>
    EMBEDDED_TERMS[resolveWebviewLanguage(appLocale)] ?? en
