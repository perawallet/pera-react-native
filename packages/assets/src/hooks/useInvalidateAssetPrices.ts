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

import { useQueryClient } from '@tanstack/react-query'

export const useInvalidateAssetPrices = () => {
    const queryClient = useQueryClient()

    const invalidateAssetPrices = () => {
        try {
            queryClient.invalidateQueries({
                predicate: query => {
                    try {
                        // Handle edge cases: null, undefined, or non-array queryKey
                        if (!query.queryKey || !Array.isArray(query.queryKey)) {
                            return false
                        }
                        
                        // Handle empty array
                        if (query.queryKey.length === 0) {
                            return false
                        }
                        
                        // Check if the query key starts with 'assets/prices'
                        return query.queryKey.join('/').startsWith('assets/prices')
                    } catch (error) {
                        // If any error occurs during predicate evaluation, don't invalidate the query
                        return false
                    }
                },
            })
        } catch (error) {
            // Silently handle any errors during invalidation
            console.error('Error invalidating asset prices:', error)
        }
    }

    return {
        invalidateAssetPrices,
    }
}
