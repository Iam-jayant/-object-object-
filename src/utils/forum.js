const FORUM_API_URL = (
  import.meta.env.VITE_FORUM_API_URL ||
  import.meta.env.VITE_NOTIFY_API_URL ||
  import.meta.env.VITE_DIRECTORY_API_URL ||
  ''
).trim();

function getBaseUrl() {
  if (!FORUM_API_URL) {
    throw new Error('Forum API URL is not configured');
  }
  return FORUM_API_URL.replace(/\/$/, '');
}

export async function fetchForumPosts(limit = 50) {
  const base = getBaseUrl();
  const res = await fetch(`${base}/forum/posts?limit=${encodeURIComponent(limit)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to load posts (${res.status})`);
  }
  const body = await res.json();
  return Array.isArray(body?.posts) ? body.posts : [];
}

export async function createForumPost(payload) {
  const base = getBaseUrl();
  const res = await fetch(`${base}/forum/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Failed to create post (${res.status})`);
  }
  return body?.post;
}
