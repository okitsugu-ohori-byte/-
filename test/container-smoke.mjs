import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const env = { ...process.env, APP_PASSWORD: randomBytes(24).toString('hex') };
for (const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[key];
const docker = (...args) => execFileSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { env, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
const suffix=randomBytes(4).toString('hex'), name='kaden-smoke-'+suffix, volume=name+'-data';
const headers={ Authorization:'Basic '+Buffer.from('admin:'+env.APP_PASSWORD).toString('base64') };
const base='http://127.0.0.1:3033';
const fixtures=mkdtempSync(join(tmpdir(),'kaden-container-fixtures-'));
execFileSync('python3',['test/fixtures.py',fixtures]);
let created=false;
try {
  docker('volume','create',volume);
  const args=['run','-d','--name',name,'-p','127.0.0.1:3033:10000','--mount',`type=volume,src=${volume},dst=/var/data`,'--env','APP_PASSWORD','--env','RENDER_EXTERNAL_URL=https://kaden-smoke.onrender.com'];
  if(env.CODEX_PROXY_CERT) args.push('--mount',`type=bind,src=${env.CODEX_PROXY_CERT},dst=/run/proxy-ca.pem,readonly`,'--env','NODE_EXTRA_CA_CERTS=/run/proxy-ca.pem');
  args.push('kaden-concierge:render');
  docker(...args);created=true;
  for(let i=0;i<100;i++){
    try { if((await fetch(base+'/api/health',{headers})).ok) break; }catch{}
    await new Promise(r=>setTimeout(r,150));
  }
  assert.equal((await fetch(base+'/')).status,401);
  assert.equal((await fetch(base+'/',{headers})).status,200);
  const state=await (await fetch(base+'/api/state',{headers})).json();
  assert.equal(state.config.redirectUri,'https://kaden-smoke.onrender.com/api/google/callback');
  const createdTask=await fetch(base+'/api/tasks',{method:'POST',headers:{...headers,'content-type':'application/json',Origin:'https://kaden-smoke.onrender.com'},body:JSON.stringify({title:'永続ボリューム確認',dueDate:'2026-11-01'})});
  assert.equal(createdTask.status,200);const task=await createdTask.json();
  const form=new FormData();form.append('file',new Blob([readFileSync(join(fixtures,'review.pptx'))]),'review.pptx');
  const uploaded=await fetch(base+'/api/documents/upload',{method:'POST',headers,body:form});assert.equal(uploaded.status,200,await uploaded.clone().text());const doc=await uploaded.json();
  const rendered=await fetch(`${base}/api/documents/${doc.id}/render`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}'});assert.equal(rendered.status,200,await rendered.clone().text());
  const jpg=await fetch(`${base}/api/documents/${doc.id}/slides/1`,{headers});assert.equal(jpg.status,200);assert.equal(jpg.headers.get('content-type'),'image/jpeg');
  docker('exec','--user','app',name,'node','scripts/healthcheck.mjs');
  assert.equal(docker('exec',name,'sh','-c','stat -c %U /var/data/workspace.sqlite'),'app');
  docker('restart',name);
  for(let i=0;i<100;i++){
    try { if((await fetch(base+'/api/health',{headers})).ok) break; }catch{}
    await new Promise(r=>setTimeout(r,150));
  }
  const restored=await(await fetch(base+'/api/state',{headers})).json();
  assert.ok(restored.tasks.some(t=>t.id===task.id));assert.ok(restored.documents.some(d=>d.id===doc.id));
  console.log('Container smoke passed: authentication, HTTPS-origin settings, data persistence, Python PPTX import, LibreOffice rendering, JPEG serving, health check, app-owned database, restart.');
} catch (error) {
  if (created) {
    console.error('Container status:', docker('inspect','--format','{{.State.Status}} / {{.State.ExitCode}}',name));
    const logs = spawnSync('docker',['--host=unix:///var/run/docker.sock','logs','--tail','30',name],{env,encoding:'utf8'});
    console.error((logs.stdout || '') + (logs.stderr || ''));
  }
  throw error;
} finally {
  if(created)docker('rm','-f',name);
  docker('volume','rm',volume);
}
