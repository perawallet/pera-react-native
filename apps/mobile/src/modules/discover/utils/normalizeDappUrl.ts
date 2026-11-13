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

import { toValidatedBrowserUrl } from "@modules/webview";
import type { Nullable } from "@perawallet/wallet-core-shared";

const HTTPS_PREFIX = /^https:\/\//i;
const HTTPS = "https://";

// String operations only: React Native's URL is lenient, so it cannot be
// trusted to canonicalise.
export const normalizeDappUrl = (url: string): Nullable<string> => {
  const validated = toValidatedBrowserUrl(url);
  if (validated === null) return null;
  const withScheme = validated.replace(HTTPS_PREFIX, HTTPS);
  const hashAt = withScheme.indexOf("#");
  const noHash = hashAt === -1 ? withScheme : withScheme.slice(0, hashAt);
  const rest = noHash.slice(HTTPS.length);
  const hostEnd = rest.search(/[/?]/);
  const host = (hostEnd === -1 ? rest : rest.slice(0, hostEnd)).toLowerCase();
  const tail = hostEnd === -1 ? "" : rest.slice(hostEnd);
  const queryAt = tail.indexOf("?");
  const path = queryAt === -1 ? tail : tail.slice(0, queryAt);
  const query = queryAt === -1 ? "" : tail.slice(queryAt);
  const trimmedPath = path.endsWith("/") ? path.slice(0, -1) : path;
  return `${HTTPS}${host}${trimmedPath}${query}`;
};

export const dappHostOf = (url: string): string => {
  if (!HTTPS_PREFIX.test(url)) return url;
  const rest = url.replace(HTTPS_PREFIX, "");
  const end = rest.search(/[/?#]/);
  return (end === -1 ? rest : rest.slice(0, end)).toLowerCase();
};
