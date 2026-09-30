'use client';

import { useEffect, useMemo, useState } from 'react';

export default function Home() {
  const [bridgeKey, setBridgeKey] = useState('');
  const [file, setFile] = useState(null);
  const [assetId, setAssetId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [threadId, setThreadId] = useState('');
  const [runId, setRunId] = useState('');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('pippit_bridge_key');
    if (saved) setBridgeKey(saved);
  }, []);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${bridgeKey}` }),
    [bridgeKey],
  );

  function rememberKey(value) {
    setBridgeKey(value);
    window.localStorage.setItem('pippit_bridge_key', value);
  }

  async function upload() {
    if (!file) return;
    setError('');
    setStatus('uploading');
    const form = new FormData();
    form.append('file', file);
    const response = await fetch('/api/pippit/upload', {
      method: 'POST',
      headers,
      body: form,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Upload failed');
    setAssetId(data.asset_id);
    setStatus('uploaded');
  }

  async function submit() {
    setError('');
    setResult(null);
    setStatus('submitting');
    const response = await fetch('/api/pippit/submit', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        thread_id: threadId || undefined,
        asset_ids: assetId ? [assetId] : [],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Generation submit failed');
    setThreadId(data.thread_id);
    setRunId(data.run_id);
    setStatus('running');
  }

  async function check() {
    if (!threadId || !runId) return;
    setError('');
    const response = await fetch('/api/pippit/status', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_id: threadId, run_id: runId, after_seq: 0 }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Status check failed');
    setResult(data);
    setStatus(data.status || 'unknown');
  }

  async function guarded(fn) {
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">PRIVATE CREATIVE BRIDGE</div>
        <h1>Pippit × ChatGPT × Canva</h1>
        <p>
          Upload a Canva still, send the original creative instruction to Pippit, then bring the generated public result URL back into Canva.
        </p>
      </section>

      <section className="card">
        <h2>1. Unlock your private bridge</h2>
        <label>Bridge API key</label>
        <input
          type="password"
          value={bridgeKey}
          onChange={(e) => rememberKey(e.target.value)}
          placeholder="BRIDGE_API_KEY from Vercel"
        />
        <small>The Pippit access key stays only in Vercel. This browser stores only your bridge key locally.</small>
      </section>

      <section className="card">
        <h2>2. Optional reference image</h2>
        <p className="muted">Export your Canva scene as PNG/JPG and upload it here. Keep it under 4 MB.</p>
        <input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button disabled={!file || !bridgeKey || status === 'uploading'} onClick={() => guarded(upload)}>
          {status === 'uploading' ? 'Uploading…' : 'Upload to Pippit'}
        </button>
        {assetId && <code>Asset ID: {assetId}</code>}
      </section>

      <section className="card">
        <h2>3. Creative instruction</h2>
        <textarea
          rows={8}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Example: Animate this image into a 5-second cinematic scene. Keep the main person still while surrounding actors move naturally…"
        />
        <button className="primary" disabled={!prompt.trim() || !bridgeKey || status === 'submitting'} onClick={() => guarded(submit)}>
          {status === 'submitting' ? 'Submitting…' : 'Generate with Pippit'}
        </button>
        <p className="warning">Generation can consume Pippit credits.</p>
      </section>

      <section className="card">
        <h2>4. Check result</h2>
        <div className="grid">
          <div><span>Thread</span><code>{threadId || '—'}</code></div>
          <div><span>Run</span><code>{runId || '—'}</code></div>
          <div><span>Status</span><strong>{status}</strong></div>
        </div>
        <button disabled={!threadId || !runId || !bridgeKey} onClick={() => guarded(check)}>Refresh status</button>
        {error && <div className="error">{error}</div>}
        {result?.interactions?.length > 0 && (
          <div className="notice">Pippit is asking for clarification. Continue the same thread with your answer.</div>
        )}
        {result?.download_urls?.length > 0 && (
          <div className="results">
            <h3>Generated results</h3>
            {result.download_urls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">Open generated asset</a>
            ))}
          </div>
        )}
      </section>

      <section className="card compact">
        <h2>ChatGPT connection</h2>
        <p>Custom GPT Action schema: <code>/openapi.json</code></p>
        <p>MCP endpoint: <code>/api/mcp</code></p>
      </section>
    </main>
  );
}
