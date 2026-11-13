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

import { useMemo } from "react";
import type { ChainId } from "@perawallet/wallet-core-chain-contract";
import { useDiscoverProjectsQuery } from "@perawallet/wallet-core-projects";
import type { Nullable } from "@perawallet/wallet-core-shared";
import type { DiscoverDapp } from "../types";
import { discoverPlatform } from "../utils/discoverPlatform";
import {
  toDiscoverDapp,
  uniqueDappsByUrl,
  verifiedDappUrls,
} from "../utils/toDiscoverDapp";
import { useDiscoverCaip2s } from "./useDiscoverCaip2s";

const TOP_DAPPS_COUNT = 4;

export type UseTopDappsResult = {
  dapps: DiscoverDapp[];
  verifiedUrls: ReadonlySet<string>;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
};

export const useTopDapps = (chainId: Nullable<ChainId>): UseTopDappsResult => {
  const caip2s = useDiscoverCaip2s(chainId ? [chainId] : []);
  const query = useDiscoverProjectsQuery({
    platform: discoverPlatform(),
    chains: caip2s,
    isEnabled: caip2s.length > 0,
  });
  const dapps = useMemo(
    () =>
      uniqueDappsByUrl(
        (query.data ?? []).flatMap((project) => {
          const dapp = toDiscoverDapp(project);
          return dapp === null ? [] : [dapp];
        }),
      ).slice(0, TOP_DAPPS_COUNT),
    [query.data],
  );
  const verifiedUrls = useMemo(
    () => verifiedDappUrls(query.data ?? []),
    [query.data],
  );
  return {
    dapps,
    verifiedUrls,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => query.refetch(),
  };
};
