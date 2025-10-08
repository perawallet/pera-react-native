import { PropsWithChildren } from 'react'
import {
  PersistQueryClientProvider,
  PersistQueryClientRootOptions
} from '@tanstack/react-query-persist-client'
import { OmitKeyof, QueryCache, QueryClient } from '@tanstack/react-query'

const cache = new QueryCache({
  onError: (error): void => {
    console.log('An error has occurred:', error)
  }
})
const queryClient = new QueryClient({
  queryCache: cache,
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 30,
      retry: 2
    },
    mutations: {
      //TODO do we want to enable throwOnError?
      //throwOnError: true
    }
  }
})

type QueryProviderProps = OmitKeyof<PersistQueryClientRootOptions, 'queryClient'> &
  PropsWithChildren

export function QueryProvider({ persister, children }: QueryProviderProps): React.ReactElement {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}

export { queryClient }
