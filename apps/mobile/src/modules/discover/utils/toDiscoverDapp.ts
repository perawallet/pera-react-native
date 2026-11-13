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

import type { ChainId } from "@perawallet/wallet-core-chain-contract";
import type { PeraProject } from "@perawallet/wallet-core-projects";
import type { Nullable } from "@perawallet/wallet-core-shared";
import { getProvider } from "@perawallet/wallet-extension-provider";
import { toValidatedBrowserUrl } from "@modules/webview";
import type { DiscoverDapp } from "../types";
import { dappHostOf, normalizeDappUrl } from "./normalizeDappUrl";

export const chainIdsOfCaip2s = (caip2s: readonly string[]): ChainId[] => {
  const ids = caip2s.flatMap((caip2) => {
    const chainId = getProvider().chains.byCaip2(caip2)?.chainId;
    return chainId === undefined ? [] : [chainId];
  });
  return [...new Set(ids)];
};

export const toDiscoverDapp = (p: PeraProject): Nullable<DiscoverDapp> => {
  const url = p.url === undefined ? null : toValidatedBrowserUrl(p.url);
  if (url === null) return null;
  return {
    url,
    name: p.name?.trim() || dappHostOf(url),
    logo: p.logoPng ?? null,
    categories: (p.categories ?? []).flatMap((c) => (c.title ? [c.title] : [])),
    chains: chainIdsOfCaip2s(p.chains),
    projectId: p.id,
  };
};

/** A typed URL has no project behind it, so it carries no logo, categories or chains. */
export const dappFromUrl = (url: string): Nullable<DiscoverDapp> => {
  const validated = toValidatedBrowserUrl(url);
  if (validated === null) return null;
  return {
    url: validated,
    name: dappHostOf(validated),
    logo: null,
    categories: [],
    chains: [],
  };
};

/** Keeps the first dApp per normalised url, so a duplicate project never repeats a row or key. */
export const uniqueDappsByUrl = (
  dapps: readonly DiscoverDapp[],
): DiscoverDapp[] => {
  const seen = new Set<string>();
  return dapps.filter((dapp) => {
    const key = normalizeDappUrl(dapp.url) ?? dapp.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const dappsByNormalizedUrl = (
  projects: readonly PeraProject[],
): Record<string, DiscoverDapp> => {
  const result: Record<string, DiscoverDapp> = {};
  for (const project of projects) {
    const dapp = toDiscoverDapp(project);
    if (dapp === null) continue;
    const key = normalizeDappUrl(dapp.url);
    if (key !== null && !(key in result)) result[key] = dapp;
  }
  return result;
};

// The directory is Pera's own list, so no origin check is needed.
export const verifiedDappUrls = (
  projects: readonly PeraProject[],
): ReadonlySet<string> =>
  new Set(
    projects.flatMap((p) => {
      if (p.verificationTier !== "verified") return [];
      const key = normalizeDappUrl(p.url ?? "");
      return key === null ? [] : [key];
    }),
  );
