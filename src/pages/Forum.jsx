import { useEffect, useMemo, useState } from 'react';
import { MessageSquareWarning, ImagePlus, Loader2, RefreshCw } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import WalletConnect from '../components/WalletConnect';
import { useI18n } from '../context/i18nContext';
import { uploadMultipleToIPFS, getIPFSUrl } from '../utils/ipfs';
import { createForumPost, fetchForumPosts } from '../utils/forum';

const MAX_TEXT = 200;
const MAX_IMAGES = 2;

function formatDate(ts, lang) {
  const date = new Date(Number(ts || 0));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortWallet(wallet, fallback) {
  if (!wallet) return fallback;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export default function Forum() {
  const { t, lang } = useI18n();
  const { account } = useWallet();

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postError, setPostError] = useState('');

  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [posting, setPosting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const charsLeft = useMemo(() => MAX_TEXT - content.length, [content.length]);

  async function loadPosts() {
    setLoadingPosts(true);
    setPostError('');
    try {
      const data = await fetchForumPosts(80);
      setPosts(data);
    } catch (err) {
      setPostError(err?.message || t('forum_error_load_posts'));
    } finally {
      setLoadingPosts(false);
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  function clearImages() {
    previews.forEach((u) => URL.revokeObjectURL(u));
    setFiles([]);
    setPreviews([]);
  }

  function handleFileChange(e) {
    const selected = Array.from(e.target.files || []);
    if (selected.length > MAX_IMAGES) {
      setSubmitError(t('forum_error_images_max', { count: String(MAX_IMAGES) }));
      return;
    }
    setSubmitError('');
    clearImages();
    setFiles(selected);
    setPreviews(selected.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!account) return;

    const trimmed = content.trim();
    if (!trimmed) {
      setSubmitError(t('forum_error_empty_post'));
      return;
    }
    if (trimmed.length > MAX_TEXT) {
      setSubmitError(t('forum_error_char_limit', { count: String(MAX_TEXT) }));
      return;
    }
    if (files.length > MAX_IMAGES) {
      setSubmitError(t('forum_error_images_max', { count: String(MAX_IMAGES) }));
      return;
    }

    setPosting(true);
    setSubmitError('');
    setSubmitSuccess('');

    try {
      let imageHashes = [];
      if (files.length > 0) {
        imageHashes = await uploadMultipleToIPFS(files);
      }

      const post = await createForumPost({
        wallet: account,
        content: trimmed,
        imageHashes,
      });

      setPosts((prev) => [post, ...prev]);
      setContent('');
      clearImages();
      setSubmitSuccess(t('forum_success_publish'));
    } catch (err) {
      setSubmitError(err?.message || t('forum_error_publish'));
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="w-full px-6 py-12">
      <div className="mb-8">
        <h1 className="section-title mb-1">{t('forum_title')}</h1>
        <p className="text-surface-500 text-sm">{t('forum_sub')}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 card space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquareWarning size={18} className="text-primary-600" />
            <h2 className="font-semibold text-surface-900">{t('forum_new_post')}</h2>
          </div>
          {!account ? (
            <div className="space-y-3">
              <p className="text-sm text-surface-600">{t('forum_connect_hint')}</p>
              <WalletConnect />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label">{t('forum_post_label')}</label>
                <textarea
                  className="input resize-none h-28"
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, MAX_TEXT))}
                  placeholder={t('forum_post_placeholder')}
                  required
                />
                <p className={`text-xs mt-1 ${charsLeft < 20 ? 'text-warning' : 'text-surface-600'}`}>
                  {t('forum_chars_left', { count: String(charsLeft) })}
                </p>
              </div>

              <div>
                <label className="label">{t('forum_images_label')}</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                />
                <p className="text-xs text-surface-600 mt-1">{t('forum_images_limit', { count: String(MAX_IMAGES) })}</p>
              </div>

              {previews.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {previews.map((src, i) => (
                    <img
                      key={src}
                      src={src}
                      alt={`preview-${i}`}
                      className="w-16 h-16 rounded-lg object-cover border border-surface-300"
                    />
                  ))}
                </div>
              )}

              {submitError && (
                <div className="text-xs p-2 rounded-lg border border-danger/30 bg-danger/10 text-danger">{submitError}</div>
              )}
              {submitSuccess && (
                <div className="text-xs p-2 rounded-lg border border-success/30 bg-success/10 text-success">{submitSuccess}</div>
              )}

              <button type="submit" className="btn-primary w-full justify-center" disabled={posting}>
                {posting ? <><Loader2 size={14} className="animate-spin" /> {t('loading')}</> : <><ImagePlus size={14} /> {t('forum_publish')}</>}
              </button>
            </form>
          )}
        </div>

        <div className="lg:col-span-2 card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-surface-900">{t('forum_feed')}</h2>
            <button type="button" onClick={loadPosts} className="btn-secondary" disabled={loadingPosts}>
              <RefreshCw size={14} className={loadingPosts ? 'animate-spin' : ''} /> {t('refresh')}
            </button>
          </div>

          {loadingPosts ? (
            <div className="text-sm text-surface-600 flex items-center gap-2 py-3">
              <Loader2 size={14} className="animate-spin" /> {t('loading')}
            </div>
          ) : postError ? (
            <div className="text-xs p-2 rounded-lg border border-danger/30 bg-danger/10 text-danger">{postError}</div>
          ) : posts.length === 0 ? (
            <div className="card-sm text-sm text-surface-600">{t('forum_empty')}</div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="card-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-primary-700">{shortWallet(post.wallet, t('forum_unknown_user'))}</span>
                    <span className="text-xs text-surface-500">{formatDate(post.createdAt, lang) || t('forum_unknown_time')}</span>
                  </div>
                  <p className="text-sm text-surface-900 break-words">{post.content}</p>
                  {Array.isArray(post.imageHashes) && post.imageHashes.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {post.imageHashes.map((hash, idx) => (
                        <a key={`${post.id}-${idx}`} href={getIPFSUrl(hash)} target="_blank" rel="noopener noreferrer">
                          <img
                            src={getIPFSUrl(hash)}
                            alt={`forum-${post.id}-${idx}`}
                            className="w-20 h-20 rounded-lg object-cover border border-surface-300"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
