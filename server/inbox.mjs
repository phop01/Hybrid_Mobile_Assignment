// API ส่วน "กล่องแจ้งเตือน" ของ KKUNK Today

export function registerInboxRoutes(ctx) {
  const { db, send, requireUser } = ctx;

  return async function handle(req, res, { url, method }) {
    // GET /me/inbox?since=ISO (แจ้งเตือนของฉันที่ใหม่กว่า since ใหม่สุดก่อน)
    if (method === 'GET' && url.pathname === '/me/inbox') {
      const user = requireUser(req);
      const since = url.searchParams.get('since') ?? '';
      const list = db.notifications
        .filter((n) => n.userId === user.id && n.createdAt > since)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 50)
        .map(({ userId, ...rest }) => rest);
      send(res, 200, list);
      return true;
    }
    return false;
  };
}
