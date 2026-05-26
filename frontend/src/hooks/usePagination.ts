/**
 * usePagination Hook - Task 15.3
 * Cursor-based pagination for API responses.
 */

import { useState, useCallback } from 'react';

export const usePagination = (pageSize = 100) => {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);

  const updatePagination = useCallback((paginationData) => {
    if (paginationData) {
      setPage(paginationData.page || 1);
      setTotalPages(paginationData.total_pages || 1);
      setTotalItems(paginationData.total_items || 0);
    }
  }, []);

  const nextPage = useCallback(() => {
    setPage(p => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage(p => Math.max(p - 1, 1));
  }, []);

  const goToPage = useCallback((p) => {
    setPage(Math.max(1, Math.min(p, totalPages)));
  }, [totalPages]);

  const reset = useCallback(() => {
    setPage(1);
  }, []);

  return {
    page, pageSize, totalPages, totalItems, loading,
    setLoading, updatePagination, nextPage, prevPage, goToPage, reset,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

export default usePagination;
