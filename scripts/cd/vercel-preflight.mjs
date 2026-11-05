const token = process.env.VERCEL_TOKEN;
const orgId = process.env.VERCEL_ORG_ID;
const projectId = process.env.VERCEL_PROJECT_ID;

if (!token || !orgId || !projectId) {
  throw new Error('Thiếu VERCEL_TOKEN, VERCEL_ORG_ID hoặc VERCEL_PROJECT_ID');
}

const url = new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}`);
if (orgId.startsWith('team_')) url.searchParams.set('teamId', orgId);
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  signal: AbortSignal.timeout(20_000),
});
if (!response.ok) throw new Error(`Vercel API trả HTTP ${response.status} khi kiểm tra project`);

const project = await response.json();
const linkedRepo = `${project.link?.org ?? ''}/${project.link?.repo ?? ''}`
  .toLowerCase().replace(/^\/+/, '').replace(/\.git$/, '');
const expectedRepo = 'phuctruong11/brewlite-assignment2';
if (project.id !== projectId || project.accountId !== orgId ||
    project.name !== 'brewlite-frontend' ||
    project.rootDirectory !== 'apps/web' ||
    project.link?.type !== 'github' ||
    (linkedRepo !== expectedRepo && project.link?.repo?.toLowerCase() !== expectedRepo) ||
    project.link?.productionBranch !== 'main') {
  throw new Error('Vercel phải trỏ tới project brewlite-frontend, repo brewlite-assignment2, nhánh main, Root Directory apps/web');
}

console.log('Vercel production đã trỏ đúng project, repo, nhánh và thư mục web');
