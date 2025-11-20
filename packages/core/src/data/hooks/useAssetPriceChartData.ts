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
import type { AssetPriceChartDataResponse, AssetPriceChartDataQueryParams } from "../types/AssetPriceChartDataTypes";
import type { QueryKey, QueryClient, QueryObserverOptions, UseSuspenseQueryOptions, UseSuspenseQueryResult } from "@tanstack/react-query";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { assetPriceChartDataResponseSchema } from "../zod/assetPriceChartDataResponse";

export const AssetPriceChartDataQueryKey = (params: AssetPriceChartDataQueryParams) => [{ url: '/v1/assets/price-chart/' }, ...(params ? [params] : [])] as const

export type AssetPriceChartDataQueryKey = ReturnType<typeof AssetPriceChartDataQueryKey>

export async function AssetPriceChartDataRequest({ params }: { params: AssetPriceChartDataQueryParams }, config: Partial<RequestConfiguration> & { client?: typeof fetch } = {}) {
  const { client: request = fetch, ...requestConfig } = config

  const res = await request<AssetPriceChartDataResponse, ResponseErrorConfiguration<Error>, unknown>({ backend: 'pera', method: "GET", url: `/v1/assets/price-chart/`, params, ...requestConfig })
  return assetPriceChartDataResponseSchema.parse(res.data)
}

export function AssetPriceChartDataQueryOptions({ params }: { params: AssetPriceChartDataQueryParams }, config: Partial<RequestConfiguration> & { client?: typeof fetch } = {}) {
  const queryKey = AssetPriceChartDataQueryKey(params)
  return queryOptions<AssetPriceChartDataResponse, ResponseErrorConfiguration<Error>, AssetPriceChartDataResponse, typeof queryKey>({
    enabled: !!(params),
    queryKey,
    queryFn: async ({ signal }) => {
      config.signal = signal
      return AssetPriceChartDataRequest({ params }, config)
    },
  })
}

export function useAssetPriceChartData<TData = AssetPriceChartDataResponse, TQueryData = AssetPriceChartDataResponse, TQueryKey extends QueryKey = AssetPriceChartDataQueryKey>({ params }: { params: AssetPriceChartDataQueryParams }, options:
  {
    query?: Partial<QueryObserverOptions<AssetPriceChartDataResponse, ResponseErrorConfiguration<Error>, TData, TQueryData, TQueryKey>> & { client?: QueryClient },
    client?: Partial<RequestConfiguration> & { client?: typeof fetch }
  }
  = {}) {
  const { query: queryConfig = {}, client: config = {} } = options ?? {}
  const { client: queryClient, ...queryOptions } = queryConfig
  const queryKey = queryOptions?.queryKey ?? AssetPriceChartDataQueryKey(params)

  const query = useSuspenseQuery({
    ...AssetPriceChartDataQueryOptions({ params }, config),
    queryKey,
    ...queryOptions
  } as unknown as UseSuspenseQueryOptions, queryClient) as UseSuspenseQueryResult<TData, ResponseErrorConfiguration<Error>> & { queryKey: TQueryKey }

  query.queryKey = queryKey as TQueryKey

  return query
}