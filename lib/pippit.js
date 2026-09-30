const DEFAULT_BASE = 'https://www.pippit.ai';
const SUBMIT_RUN_PATH = '/api/biz/v1/skill/submit_run';
const GET_THREAD_PATH = '/api/biz/v1/skill/get_thread';
const UPLOAD_FILE_PATH = '/api/biz/v1/skill/upload_file';

function baseUrl() {
  return (process.env.PIPPIT_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
}

function accessKey() {
  const key = process.env.PIPPIT_ACCESS_KEY;
  if (!key) throw new Error('PIPPIT_ACCESS_KEY is not configured');
  return key;
}

async function readJson(response) {
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Pippit returned non-JSON response (${response.status})`);
  }

  if (!response.ok) {
    const message = payload?.errmsg || payload?.message || `HTTP ${response.status}`;
    throw new Error(`Pippit API error: ${message}`);
  }

  const ret = String(payload?.ret ?? '');
  if (ret && ret !== '0') {
    throw new Error(`Pippit API error ${ret}: ${payload?.errmsg || 'unknown error'}`);
  }

  return payload?.data && typeof payload.data === 'object' ? payload.data : payload;
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return readJson(response);
}

export async function submitRun({ message, threadId = '', assetIds = [] }) {
  if (!message || !message.trim()) throw new Error('message is required');

  const body = { message: message.trim() };
  if (threadId) body.thread_id = threadId;
  if (Array.isArray(assetIds) && assetIds.length) body.asset_ids = assetIds;

  const data = await postJson(SUBMIT_RUN_PATH, body);
  const run = data?.run || {};

  if (!run.thread_id || !run.run_id) {
    throw new Error('Pippit response did not include thread_id/run_id');
  }

  const webThreadLink =
    data.web_thread_link ||
    `https://www.pippit.ai/home?tab_name=integrated-agent&thread_id=${encodeURIComponent(run.thread_id)}&agent_name=pippit_nest_agent`;

  return {
    thread_id: run.thread_id,
    run_id: run.run_id,
    web_thread_link: webThreadLink,
  };
}

function normalizeState(value) {
  const state = String(value ?? '').trim().toLowerCase();
  if (['3', 'completed', 'complete', 'succeeded', 'success', 'done', 'runstate_completed'].includes(state)) return 'completed';
  if (['4', 'failed', 'failure', 'error', 'runstate_failed'].includes(state)) return 'failed';
  if (['5', 'canceled', 'cancelled', 'runstate_canceled'].includes(state)) return 'canceled';
  if (['9', 'requires_action', 'requires_user_input', 'interaction_required', 'runstate_requires_action'].includes(state)) return 'requires_action';
  return 'running';
}

function asList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function decodeData(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extractEntries(run) {
  const entries = [];
  for (const entry of asList(run?.entry_list)) {
    const source = entry?.message || entry?.artifact;
    if (!source) continue;
    entries.push({
      id: source.message_id || source.artifact_id || '',
      role: source.role || '',
      content: asList(source.content).filter((item) => {
        const sub = item?.sub_type || item?.subtype;
        return sub !== 'biz/general_agent_settings';
      }),
    });
  }
  return entries;
}

function* iterUrls(value, path = '') {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      yield* iterUrls(value[i], `${path}[${i}]`);
    }
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, item] of Object.entries(value)) {
    const child = path ? `${path}.${key}` : key;
    const lower = key.toLowerCase();
    const looksLikeUrl = lower === 'url' || lower === 'download_url' || lower.endsWith('_url') || lower.endsWith('_urls');
    if (looksLikeUrl && typeof item === 'string' && /^https?:\/\//i.test(item)) {
      yield { path: child, url: item };
    } else if (looksLikeUrl && Array.isArray(item)) {
      for (let i = 0; i < item.length; i += 1) {
        if (typeof item[i] === 'string' && /^https?:\/\//i.test(item[i])) {
          yield { path: `${child}[${i}]`, url: item[i] };
        }
      }
    }
    yield* iterUrls(item, child);
  }
}

function extractDownloadUrls(messages) {
  const output = [];
  const seen = new Set();
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const content of asList(message.content)) {
      if (!content || typeof content !== 'object') continue;
      const subtype = content.sub_type || content.subtype || '';
      if (String(subtype).includes('upload')) continue;
      const decoded = decodeData(content.data);
      for (const found of iterUrls(decoded)) {
        if (seen.has(found.url)) continue;
        seen.add(found.url);
        output.push(found);
      }
    }
  }
  return output;
}

function extractInteractions(messages) {
  const interactions = [];
  for (const message of messages) {
    for (const content of asList(message.content)) {
      if (!content || typeof content !== 'object') continue;
      const subtype = content.sub_type || content.subtype || '';
      if (subtype !== 'biz/x_data_dynamic_questionnaire') continue;
      interactions.push({
        id: message.id,
        data: decodeData(content.data),
      });
    }
  }
  return interactions;
}

export async function getThread({ threadId, runId, afterSeq = 0 }) {
  if (!threadId) throw new Error('thread_id is required');
  if (!runId) throw new Error('run_id is required');

  const data = await postJson(GET_THREAD_PATH, {
    thread_id: threadId,
    run_id: runId,
    after_seq: Number(afterSeq) || 0,
  });

  const runs = asList(data?.thread?.run_list);
  const run = runs.find((candidate) => candidate?.run_id === runId);
  if (!run) throw new Error(`Pippit response did not include run_id ${runId}`);

  const messages = extractEntries(run);
  const status = normalizeState(run.state);
  const downloads = extractDownloadUrls(messages);
  const interactions = extractInteractions(messages);

  return {
    status: interactions.length && status === 'running' ? 'requires_action' : status,
    fail_reason: run.fail_reason || undefined,
    download_urls: downloads.map((item) => item.url),
    downloads,
    interactions,
    messages,
  };
}

export async function uploadReference(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('file is required');
  const type = file.type || '';
  if (!type.startsWith('image/') && !type.startsWith('video/')) {
    throw new Error('Only image and video files are supported');
  }

  const form = new FormData();
  form.append('asset_type', type.startsWith('video/') ? '1' : '2');
  form.append('file', file, file.name || 'reference');

  const response = await fetch(`${baseUrl()}${UPLOAD_FILE_PATH}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessKey()}` },
    body: form,
    cache: 'no-store',
  });

  const data = await readJson(response);
  const assetId = data.pippit_asset_id || data.asset_id;
  if (!assetId) throw new Error('Pippit upload did not return an asset id');

  return {
    asset_id: assetId,
    pippit_asset_id: data.pippit_asset_id || undefined,
    everphoto_asset_id: data.asset_id || undefined,
  };
}

function assertCanvaAssetUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid Canva asset URL');
  }
  if (parsed.protocol !== 'https:') throw new Error('Canva asset URL must use HTTPS');

  const host = parsed.hostname.toLowerCase();
  if (host !== 'canva.com' && !host.endsWith('.canva.com')) {
    throw new Error('Only temporary Canva asset URLs are accepted');
  }
  return parsed.toString();
}

export async function uploadReferenceFromCanvaUrl(rawUrl) {
  const url = assertCanvaAssetUrl(rawUrl);
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Could not download selected Canva asset (HTTP ${response.status})`);
  }

  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
  if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
    throw new Error(`Unsupported Canva asset type: ${contentType || 'unknown'}`);
  }

  const maxBytes = contentType.startsWith('video/') ? 80 * 1024 * 1024 : 25 * 1024 * 1024;
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new Error('Selected Canva asset is too large for direct transfer');
  }

  const extension =
    contentType === 'image/png' ? 'png' :
    contentType === 'image/webp' ? 'webp' :
    contentType === 'video/mp4' ? 'mp4' :
    contentType.startsWith('video/') ? 'video' : 'jpg';

  const file = new File([buffer], `canva-reference.${extension}`, { type: contentType });
  return uploadReference(file);
}
