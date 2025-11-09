import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CatalogFilters, fetchCatalogPage, fetchGenres, fetchPlatforms } from '../services/catalog';
import { Game } from '../services/igdb';

const PAGE_SIZE = 30;

export function useCatalogGames(filters: CatalogFilters) {
  return useInfiniteQuery<Game[], Error>({
    queryKey: ['catalog', filters],
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length === PAGE_SIZE ? allPages.length : undefined),
    queryFn: ({ pageParam }) => fetchCatalogPage(pageParam as number, PAGE_SIZE, filters),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
  });
}

export function useCatalogFilters() {
  const genres = useQuery({ queryKey: ['catalog:genres'], queryFn: fetchGenres, staleTime: 1000 * 60 * 60 });
  const platforms = useQuery({ queryKey: ['catalog:platforms'], queryFn: fetchPlatforms, staleTime: 1000 * 60 * 60 });
  return { genres, platforms };
}

