const origin = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
if (!process.env.APP_PASSWORD) {
  throw new Error('APP_PASSWORDを公開先の環境変数に設定してください。');
}
if (!origin) {
  throw new Error('公開先のHTTPS URLをAPP_ORIGINに設定してください。Renderでは自動設定されます。');
}
const publicUrl = new URL(origin);
if (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password || publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash) {
  throw new Error('APP_ORIGINはパス・認証情報なしのHTTPSオリジンにしてください。');
}
process.env.APP_ORIGIN = publicUrl.origin;
process.env.HOST ||= '0.0.0.0';
process.env.PORT ||= '10000';
process.env.GOOGLE_REDIRECT_URI ||= `${publicUrl.origin}/api/google/callback`;

// Initialize only a fresh deployment. Preserve any existing user configuration.
const { setting, setSetting } = await import('../server/db.js');
if (!setting('config')) {
  setSetting('config', { redirectUri: process.env.GOOGLE_REDIRECT_URI });
}
const { start } = await import('../server/index.js');
const server = start();
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
