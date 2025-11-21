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

import fetch from "../query-client";
import type { RequestConfiguration, ResponseErrorConfiguration } from "../query-client";
import type { AssetPriceHistoryResponse, AssetPriceHistoryQueryParams } from "../types/AssetPriceHistory";
import type { QueryKey, QueryClient, QueryObserverOptions, UseSuspenseQueryOptions, UseSuspenseQueryResult } from "@tanstack/react-query";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { assetPriceChartDataResponseSchema } from "../zod/assetPriceChartDataResponse";

export const useAssetPriceHistoryQueryKeys = (params: AssetPriceHistoryQueryParams) => [
  AssetPriceHistoryQueryKey(params)
]

export const AssetPriceHistoryQueryKey = (params: AssetPriceHistoryQueryParams) => [{ url: '/v1/assets/price-chart/' }, ...(params ? [params] : [])] as const

export type AssetPriceHistoryQueryKey = ReturnType<typeof AssetPriceHistoryQueryKey>

export async function AssetPriceHistoryRequest({ params }: { params: AssetPriceHistoryQueryParams }, config: Partial<RequestConfiguration> & { client?: typeof fetch } = {}) {
  const { client: request = fetch, ...requestConfig } = config

  const res = await request<AssetPriceHistoryResponse, ResponseErrorConfiguration<Error>, unknown>({ backend: 'pera', method: "GET", url: `/v1/assets/price-chart/`, params, ...requestConfig })
  return assetPriceChartDataResponseSchema.parse(res.data)
}

export function AssetPriceHistoryQueryOptions({ params }: { params: AssetPriceHistoryQueryParams }, config: Partial<RequestConfiguration> & { client?: typeof fetch } = {}) {
  const queryKey = AssetPriceHistoryQueryKey(params)
  return queryOptions<AssetPriceHistoryResponse, ResponseErrorConfiguration<Error>, AssetPriceHistoryResponse, typeof queryKey>({
    enabled: !!(params),
    queryKey,
    queryFn: async ({ signal }) => {
      config.signal = signal
      return AssetPriceHistoryRequest({ params }, config)
    },
  })
}

export function useAssetPriceHistory<TData = AssetPriceHistoryResponse, TQueryData = AssetPriceHistoryResponse, TQueryKey extends QueryKey = AssetPriceHistoryQueryKey>({ params }: { params: AssetPriceHistoryQueryParams }, options:
  {
    query?: Partial<QueryObserverOptions<AssetPriceHistoryResponse, ResponseErrorConfiguration<Error>, TData, TQueryData, TQueryKey>> & { client?: QueryClient },
    client?: Partial<RequestConfiguration> & { client?: typeof fetch }
  }
  = {}) {
  const { query: queryConfig = {}, client: config = {} } = options ?? {}
  const { client: queryClient, ...queryOptions } = queryConfig
  const queryKey = queryOptions?.queryKey ?? AssetPriceHistoryQueryKey(params)

  const query = useSuspenseQuery({
    ...AssetPriceHistoryQueryOptions({ params }, config),
    queryKey,
    ...queryOptions
  } as unknown as UseSuspenseQueryOptions, queryClient) as UseSuspenseQueryResult<TData, ResponseErrorConfiguration<Error>> & { queryKey: TQueryKey }

  query.queryKey = queryKey as TQueryKey

  return query
}