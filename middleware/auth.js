export function createAuthMiddleware({ clients, adminIds }) {
  return async function requireAdmin(request, response, next) {
    if (!clients) return response.status(503).json({ error: 'The database is not configured.' });
    const bearer = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : null;
    const token = request.cookies?.portfolio_session || bearer;
    if (!token) return response.status(401).json({ error: 'Authentication required.' });
    const { data, error } = await clients.auth.getUser(token);
    if (error || !data.user || !adminIds.has(data.user.id)) return response.status(403).json({ error: 'Administrator access required.' });
    request.user = data.user;
    next();
  };
}
