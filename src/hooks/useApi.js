import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

export function useApi(url, options = {}) {
  const [data, setData] = useState(options.initial || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result } = await api.get(url);
      setData(result);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (options.skip) return;
    fetch();
  }, [fetch, options.skip]);

  return { data, loading, error, refetch: fetch };
}

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}