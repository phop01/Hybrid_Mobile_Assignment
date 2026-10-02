// API ส่วน "ประกาศทั่ววิทยาเขต" และ "กล่องแจ้งเตือน" ของ KKUNK Today

import { randomUUID } from 'node:crypto';

function text(value, min, max) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

const validLatLng = (loc) =>
  Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude) && Math.abs(loc.latitude) <= 90 && Math.abs(loc.longitude) <= 180;

export function registerBroadcastRoutes(ctx) {
  const { db, notify, persist, send, readJson, HttpError, requireUser, requireOrganizer, saveOptionalJpeg, publicUserName } = ctx;

  const invalid = (message, fields) => new HttpError(400, 'validation_failed', message, fields);

  return async function handle(req, res, { url, parts, method }) {
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

    // GET /broadcasts (ประกาศที่ยังไม่หมดอายุ) · POST /broadcasts (เจ้าหน้าที่)
    if (url.pathname === '/broadcasts') {
      if (method === 'GET') {
        requireUser(req);
        const now = new Date().toISOString();
        const list = db.broadcasts
          .filter((b) => b.expiresAt > now)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((b) => ({ imageUrl: null, ...b, byName: publicUserName(b.byId) ?? 'เจ้าหน้าที่' }));
        send(res, 200, list);
        return true;
      }
      if (method === 'POST') {
        const staff = requireOrganizer(requireUser(req));
        const body = await readJson(req);
        const errors = {};
        const message = text(body.message, 5, 200);
        if (!message) errors.message = 'ข้อความต้องยาว 5–200 ตัวอักษร';
        const loc = body.location ?? {};
        if (!text(loc.name, 2, 80)) errors.locationName = 'กรุณาระบุสถานที่';
        if (!validLatLng(loc)) errors.location = 'กรุณาปักหมุดสถานที่';
        if (!Number.isInteger(body.hours) || body.hours < 1 || body.hours > 72) errors.hours = 'ระยะเวลาประกาศต้องเป็น 1–72 ชั่วโมง';
        if (Object.keys(errors).length > 0) throw invalid('ข้อมูลไม่ถูกต้อง', errors);
        const now = Date.now();
        const id = randomUUID();
        // โปสเตอร์ไม่บังคับ: ส่งมาต้องเป็น JPEG ไม่เกิน 3 MB (saveJpeg ตอบ 400/413 ถ้าไม่ผ่าน)
        const imageUrl = saveOptionalJpeg(body.posterBase64, `broadcast-${id}.jpg`, 'โปสเตอร์');
        const broadcast = {
          id,
          message,
          location: { name: loc.name.trim(), latitude: loc.latitude, longitude: loc.longitude },
          imageUrl,
          byId: staff.id,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + body.hours * 60 * 60 * 1000).toISOString(),
        };
        db.broadcasts.push(broadcast);
        const everyone = db.users.filter((u) => u.id !== staff.id).map((u) => u.id);
        notify(everyone, { kind: 'broadcast', targetId: broadcast.id, title: `ประกาศ: ${broadcast.location.name}`, body: message });
        persist();
        send(res, 201, { ...broadcast, byName: staff.fullName });
        return true;
      }
    }

    // POST /broadcasts/:id/end (ผู้ประกาศยกเลิกประกาศก่อนหมดเวลา)
    if (method === 'POST' && parts[0] === 'broadcasts' && parts[2] === 'end' && parts.length === 3) {
      const staff = requireOrganizer(requireUser(req));
      const broadcast = db.broadcasts.find((b) => b.id === parts[1]);
      if (!broadcast) throw new HttpError(404, 'not_found', 'ไม่พบประกาศนี้');
      if (broadcast.byId !== staff.id) throw new HttpError(403, 'forbidden', 'เฉพาะผู้ประกาศเท่านั้น');
      broadcast.expiresAt = new Date().toISOString();
      persist();
      send(res, 200, { ...broadcast, byName: staff.fullName });
      return true;
    }

    return false;
  };
}
