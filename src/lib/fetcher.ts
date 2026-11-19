export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  return payload.data as T;
}

export function withRestaurant(url: string, restaurantId?: string | null) {
  if (!restaurantId) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}restaurant=${encodeURIComponent(restaurantId)}`;
}
