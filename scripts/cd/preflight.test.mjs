import assert from 'node:assert/strict';
import test from 'node:test';

const renderId = 'srv-dbksjsegekts73f2bsk0';
const vercelProject = {
  id: 'prj_brewlite',
  accountId: 'user_phuc',
  name: 'brewlite-frontend',
  rootDirectory: 'apps/web',
  link: {
    type: 'github',
    org: 'PhucTruong11',
    repo: 'brewlite-assignment2',
    productionBranch: 'main',
  },
};

async function runPreflight(script, environment, result) {
  const original = {
    argv: process.argv[2],
    fetch: globalThis.fetch,
    env: Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]])),
  };
  const calls = [];
  try {
    process.argv[2] = 'preflight';
    Object.assign(process.env, environment);
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      return { ok: true, json: async () => result };
    };
    await import(`./${script}?case=${Math.random()}`);
    return calls;
  } finally {
    process.argv[2] = original.argv;
    globalThis.fetch = original.fetch;
    for (const [key, value] of Object.entries(original.env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

await test('Render preflight chỉ đọc đúng service và source Assignment 2', async () => {
  const calls = await runPreflight('render-deploy.mjs', {
    RENDER_API_KEY: 'test-token', RENDER_SERVICE_ID: renderId,
  }, {
    id: renderId,
    repo: 'https://github.com/PhucTruong11/brewlite-assignment2',
    rootDir: 'apps/api', branch: 'main',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.render.com/v1/services/${renderId}`);
  assert.equal(calls[0].options.method, undefined);
});

await test('Render preflight chặn repo cũ trước khi deploy', async () => {
  await assert.rejects(runPreflight('render-deploy.mjs', {
    RENDER_API_KEY: 'test-token', RENDER_SERVICE_ID: renderId,
  }, {
    id: renderId,
    repo: 'https://github.com/PhucTruong11/brewlite',
    rootDir: 'backend', branch: 'main',
  }), /Render phải trỏ/);
});

await test('Vercel preflight xác minh project, repo và Root Directory', async () => {
  const calls = await runPreflight('vercel-preflight.mjs', {
    VERCEL_TOKEN: 'test-token', VERCEL_ORG_ID: 'user_phuc',
    VERCEL_PROJECT_ID: 'prj_brewlite',
  }, vercelProject);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.vercel.com/v9/projects/prj_brewlite');
  assert.equal(calls[0].options.method, undefined);
});

await test('Vercel preflight chặn Root Directory cũ', async () => {
  await assert.rejects(runPreflight('vercel-preflight.mjs', {
    VERCEL_TOKEN: 'test-token', VERCEL_ORG_ID: 'user_phuc',
    VERCEL_PROJECT_ID: 'prj_brewlite',
  }, { ...vercelProject, rootDirectory: 'frontend' }), /Vercel phải trỏ/);
});
