try {
  if (!process.env.APP_PASSWORD) process.exit(1);
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || 10000}/api/health`, {
    headers: { Authorization: 'Basic ' + Buffer.from(`health:${process.env.APP_PASSWORD}`).toString('base64') },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok || !(await response.json()).ok) process.exit(1);
} catch {
  process.exit(1);
}
