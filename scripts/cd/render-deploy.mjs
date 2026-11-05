import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const mode = process.argv[2];
const apiKey = process.env.RENDER_API_KEY;
const serviceId = process.env.RENDER_SERVICE_ID;
const releaseSha = process.env.GITHUB_SHA;
const statePath = join(process.env.GITHUB_WORKSPACE ?? process.cwd(), '.render-previous-commit');

if (!apiKey || !serviceId || !['preflight', 'deploy', 'rollback'].includes(mode)) {
  throw new Error('Thiếu RENDER_API_KEY, RENDER_SERVICE_ID hoặc chế độ preflight/deploy/rollback');
}

if (serviceId !== 'srv-dbksjsegekts73f2bsk0') {
  throw new Error('RENDER_SERVICE_ID không khớp service production BrewLite đã xác nhận');
}

const base = `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}`;
async function renderRequest(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Render API trả HTTP ${response.status} tại ${path}`);
  return response.json();
}

async function waitForDeploy(id) {
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    const deploy = await renderRequest(`/deploys/${encodeURIComponent(id)}`);
    console.log(`Render deploy ${id}: ${deploy.status}`);
    if (deploy.status === 'live') return;
    if (['build_failed', 'update_failed', 'pre_deploy_failed', 'canceled'].includes(deploy.status)) {
      throw new Error(`Render deploy thất bại: ${deploy.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error('Render deploy chưa hoàn tất sau 15 phút');
}

async function assertService() {
  const service = await renderRequest('');
  const repo = (service.repo ?? '').replace(/\.git$/, '').toLowerCase();
  if (service.id !== serviceId ||
      !repo.endsWith('/phuctruong11/brewlite-assignment2') ||
      service.rootDir !== 'apps/api' || service.branch !== 'main') {
    throw new Error('Render phải trỏ tới repo brewlite-assignment2, nhánh main, Root Directory apps/api');
  }
  console.log('Render production đã trỏ đúng repo, nhánh và thư mục API');
}

if (mode === 'preflight') {
  await assertService();
} else if (mode === 'deploy') {
  if (!releaseSha) throw new Error('Thiếu GITHUB_SHA');
  await assertService();
  const history = await renderRequest('/deploys?limit=20');
  const previous = history.map((item) => item.deploy).find((item) => item.status === 'live' && item.commit?.id);
  await writeFile(statePath, previous?.commit.id ?? '', { mode: 0o600 });
  const deploy = await renderRequest('/deploys', {
    method: 'POST',
    body: JSON.stringify({ commitId: releaseSha }),
  });
  console.log(`Đã yêu cầu Render deploy commit ${releaseSha}`);
  await waitForDeploy(deploy.id);
} else {
  const previousCommit = (await readFile(statePath, 'utf8').catch(() => '')).trim();
  if (!previousCommit) throw new Error('Không có commit Render trước đó để rollback tự động');
  const deploy = await renderRequest('/deploys', {
    method: 'POST',
    body: JSON.stringify({ commitId: previousCommit }),
  });
  console.log(`Đang khôi phục Render về commit ${previousCommit}`);
  await waitForDeploy(deploy.id);
}
