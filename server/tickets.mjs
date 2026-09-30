// API ส่วน "เรื่อง" ของ NK Today: แจ้งซ่อม, ประกาศทั่ววิทยาเขต และกล่องแจ้งเตือน
//
// flow แจ้งซ่อม:
//   open (มีคนแจ้ง) → accepted (เจ้าหน้าที่อาคารรับเรื่อง) → done (ซ่อมเสร็จ) → confirmed (ผู้แจ้งยืนยัน)
//   แตกออกได้: rejected (เจ้าหน้าที่ปฏิเสธ), cancelled (ผู้แจ้งยกเลิก), done → accepted (ผู้แจ้งบอกว่ายังไม่เรียบร้อย)
// ทุกครั้งที่สถานะเปลี่ยน server ใส่แจ้งเตือนให้อีกฝั่งเอง แอปไม่ต้องมีปุ่มทดสอบแจ้งเตือน

import { randomUUID } from 'node:crypto';

import { rolesOf } from './roles.mjs';

export const REPAIR_CATEGORIES = ['electric', 'water', 'building', 'road', 'cleaning', 'other'];

const OPEN_STATES = ['open', 'accepted'];

/** กันส่งเรื่องรัว ๆ (ทุกเรื่องใหม่ทำให้เจ้าหน้าที่ได้แจ้งเตือน) */
const CREATE_LIMIT = 5;
const CREATE_WINDOW_MS = 10 * 60 * 1000;

function formatThai(iso) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function text(value, min, max) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

const validLatLng = (loc) =>
  Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude) && Math.abs(loc.latitude) <= 90 && Math.abs(loc.longitude) <= 180;

/** ตรวจข้อมูลแจ้งเรื่อง (ซ้ำกับฝั่งแอป เพราะ client ถูกแก้ไขได้) */
export function validateTicketBody(body) {
  const errors = {};
  if (body.kind !== 'repair') errors.kind = 'ประเภทเรื่องไม่ถูกต้อง';
  if (!REPAIR_CATEGORIES.includes(body.category)) errors.category = 'กรุณาเลือกหมวด';
  if (!text(body.title, 5, 80)) errors.title = 'หัวข้อต้องยาว 5–80 ตัวอักษร';
  if (body.detail !== undefined && body.detail !== '' && !text(body.detail, 1, 500)) errors.detail = 'รายละเอียดยาวได้ไม่เกิน 500 ตัวอักษร';
  const loc = body.location ?? {};
  if (!text(loc.name, 2, 80)) errors.locationName = 'กรุณาระบุจุดที่เกิดเรื่อง เช่น ชื่ออาคาร/ชั้น';
  if (!validLatLng(loc)) errors.location = 'กรุณาปักหมุดตำแหน่ง';
  // แจ้งซ่อมต้องมีรูป: ช่างรู้ว่าต้องเตรียมอะไรไป และเป็นหลักฐานก่อน/หลังซ่อม
  if ((typeof body.photoBase64 !== 'string' || body.photoBase64.length < 100)) {
    errors.photo = 'แจ้งซ่อมต้องแนบรูปปัญหา';
  }
  return errors;
}

export function registerTicketRoutes(ctx) {
  const { db, notify, persist, send, readJson, HttpError, requireUser, requireOrganizer, requireStaff, saveJpeg, saveOptionalJpeg, publicUserName } =
    ctx;

  const invalid = (message, fields) => new HttpError(400, 'validation_failed', message, fields);

  const findTicket = (id) => {
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) throw new HttpError(404, 'ticket_not_found', 'ไม่พบเรื่องนี้');
    return ticket;
  };

  const publicTicket = (ticket, viewer) => {
    const { idempotencyKey, followerIds, ...rest } = ticket;
    return {
      ...rest,
      reporterName: publicUserName(ticket.reporterId) ?? 'ผู้ใช้',
      assigneeName: ticket.assigneeId ? publicUserName(ticket.assigneeId) : null,
      followerCount: followerIds.length,
      following: followerIds.includes(viewer.id),
    };
  };

  const addEvent = (ticket, type, byId, note = null) => {
    ticket.events.push({ at: new Date().toISOString(), type, byId, ...(note ? { note } : {}) });
  };

  /** คนที่ต้องรู้เมื่อเรื่องคืบหน้า: ผู้แจ้ง + คนที่กด "เจอเหมือนกัน" */
  const watchers = (ticket) => [ticket.reporterId, ...ticket.followerIds];

  const notifyTicket = (userIds, ticket, title, body) =>
    notify(userIds, { kind: 'ticket', targetId: ticket.id, title, body: body ?? ticket.title });

  const requireStatus = (ticket, allowed, message) => {
    if (!allowed.includes(ticket.status)) throw new HttpError(409, 'invalid_status', message);
  };

  const requireAssignee = (ticket, user) => {
    if (ticket.assigneeId !== user.id) throw new HttpError(403, 'forbidden', 'เฉพาะผู้ที่รับเรื่องนี้');
  };

  const requireReporter = (ticket, user) => {
    if (ticket.reporterId !== user.id) throw new HttpError(403, 'forbidden', 'เฉพาะผู้แจ้งเรื่องนี้');
  };

  const parseAppointment = (value) => {
    if (value === undefined || value === null) return null;
    const time = Date.parse(value);
    if (!Number.isFinite(time) || time < Date.now() - 5 * 60 * 1000 || time > Date.now() + 60 * 24 * 60 * 60 * 1000) {
      throw new HttpError(400, 'invalid_appointment', 'เวลานัดต้องอยู่ในอนาคต (ไม่เกิน 60 วัน)');
    }
    return new Date(time).toISOString();
  };

  return async function ticketRoutes(req, res, { url, parts, method }) {
    // GET /tickets (ทุกเรื่องที่ยังไม่ถูกยกเลิก ใหม่สุดก่อน)
    if (method === 'GET' && url.pathname === '/tickets') {
      const user = requireUser(req);
      const list = db.tickets
        .filter((t) => t.kind === 'repair' && (t.status !== 'cancelled' || t.reporterId === user.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((t) => publicTicket(t, user));
      send(res, 200, list);
      return true;
    }

    // POST /tickets (แจ้งซ่อม)
    if (method === 'POST' && url.pathname === '/tickets') {
      const user = requireUser(req);
      const body = await readJson(req);
      const idempotencyKey = req.headers['idempotency-key'];
      // ส่งซ้ำจากคิวออฟไลน์ด้วย key เดิม → คืนเรื่องเดิม ไม่สร้างซ้ำ
      if (typeof idempotencyKey === 'string') {
        const previous = db.tickets.find((t) => t.idempotencyKey === idempotencyKey && t.reporterId === user.id);
        if (previous) {
          send(res, 200, publicTicket(previous, user));
          return true;
        }
      }
      const recent = db.tickets.filter(
        (t) => t.reporterId === user.id && Date.now() - Date.parse(t.createdAt) < CREATE_WINDOW_MS,
      ).length;
      if (recent >= CREATE_LIMIT) {
        throw new HttpError(429, 'too_many_tickets', 'แจ้งเรื่องถี่เกินไป กรุณารอสักครู่แล้วลองใหม่');
      }
      const errors = validateTicketBody(body);
      if (Object.keys(errors).length > 0) throw invalid('ข้อมูลไม่ถูกต้อง', errors);
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const ticket = {
        id,
        kind: body.kind,
        category: body.category,
        title: body.title.trim(),
        detail: typeof body.detail === 'string' ? body.detail.trim() : '',
        location: { name: body.location.name.trim(), latitude: body.location.latitude, longitude: body.location.longitude },
        photoUrl: saveJpeg(body.photoBase64, `ticket-${id}.jpg`, 'รูปปัญหา'),
        afterPhotoUrl: null,
        status: 'open',
        reporterId: user.id,
        assigneeId: null,
        followerIds: [],
        appointmentAt: null,
        note: null,
        createdAt,
        events: [{ at: createdAt, type: 'created', byId: user.id }],
        idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
      };
      db.tickets.push(ticket);

      // แจ้งเฉพาะเจ้าหน้าที่อาคารสถานที่ (คนที่รับงานซ่อมได้จริง)
      // ทุกคนที่มีบทบาทเจ้าหน้าที่อาคาร (ไม่ขึ้นกับว่าตอนนี้ใช้บทบาทไหนอยู่)
      const staff = db.users.filter((u) => rolesOf(u).includes('facilities')).map((u) => u.id);
      notifyTicket(staff, ticket, `แจ้งซ่อมใหม่: ${ticket.title}`, ticket.location.name);
      persist();
      send(res, 201, publicTicket(ticket, user));
      return true;
    }

    // GET /tickets/:id
    if (method === 'GET' && parts[0] === 'tickets' && parts.length === 2) {
      const user = requireUser(req);
      send(res, 200, publicTicket(findTicket(parts[1]), user));
      return true;
    }

    // POST /tickets/:id/<action>
    if (method === 'POST' && parts[0] === 'tickets' && parts.length === 3) {
      const user = requireUser(req);
      const ticket = findTicket(parts[1]);
      const action = parts[2];
      const body = await readJson(req);

      switch (action) {
        // "เจอเหมือนกัน": ติดตามเรื่องที่มีคนแจ้งไว้แล้ว แทนการแจ้งซ้ำ (กดซ้ำ = เลิกติดตาม)
        case 'follow': {
          if (ticket.reporterId === user.id) throw new HttpError(409, 'own_ticket', 'คุณเป็นผู้แจ้งเรื่องนี้อยู่แล้ว');
          requireStatus(ticket, OPEN_STATES, 'เรื่องนี้ปิดไปแล้ว');
          const index = ticket.followerIds.indexOf(user.id);
          if (index >= 0) ticket.followerIds.splice(index, 1);
          else ticket.followerIds.push(user.id);
          break;
        }

        // รับเรื่อง: ได้คนเดียว คนที่สองได้ 409 (กันไปซ่อมซ้ำ)
        case 'accept': {
          requireStaff(user, 'facilities');
          if (ticket.reporterId === user.id) throw new HttpError(403, 'forbidden', 'รับเรื่องของตัวเองไม่ได้');
          if (ticket.status !== 'open') throw new HttpError(409, 'already_taken', 'มีคนรับเรื่องนี้ไปแล้ว');
          const appointmentAt = parseAppointment(body.appointmentAt);
          ticket.status = 'accepted';
          ticket.assigneeId = user.id;
          ticket.appointmentAt = appointmentAt;
          addEvent(ticket, 'accepted', user.id);
          notifyTicket(
            watchers(ticket),
            ticket,
            'เจ้าหน้าที่รับเรื่องแจ้งซ่อมแล้ว',
            appointmentAt ? `${ticket.title} · นัดเข้าซ่อม ${formatThai(appointmentAt)}` : ticket.title,
          );
          break;
        }

        // เจ้าหน้าที่ทำเรื่องนี้ไม่ได้แล้ว → คืนเรื่องให้คนอื่นรับต่อ
        case 'release': {
          requireStaff(user, 'facilities');
          requireAssignee(ticket, user);
          requireStatus(ticket, ['accepted'], 'คืนเรื่องได้เฉพาะตอนกำลังดำเนินการ');
          ticket.status = 'open';
          ticket.assigneeId = null;
          ticket.appointmentAt = null;
          addEvent(ticket, 'released', user.id);
          notifyTicket([ticket.reporterId], ticket, 'เจ้าหน้าที่คืนเรื่องแจ้งซ่อม');
          break;
        }

        // เจ้าหน้าที่นัด/เลื่อนเวลาเข้าซ่อม
        case 'schedule': {
          requireStaff(user, 'facilities');
          requireAssignee(ticket, user);
          requireStatus(ticket, ['accepted'], 'นัดได้เฉพาะเรื่องที่กำลังดำเนินการ');
          const appointmentAt = parseAppointment(body.appointmentAt);
          if (!appointmentAt) throw new HttpError(400, 'invalid_appointment', 'กรุณาเลือกเวลานัด');
          ticket.appointmentAt = appointmentAt;
          addEvent(ticket, 'scheduled', user.id, formatThai(appointmentAt));
          notifyTicket(watchers(ticket), ticket, 'นัดเวลาเข้าซ่อมแล้ว', `${ticket.title} · ${formatThai(appointmentAt)}`);
          break;
        }

        // ทำเสร็จ: แจ้งซ่อมต้องมีรูปหลังซ่อม (ผู้แจ้งเทียบก่อน/หลังได้)
        case 'done': {
          requireStaff(user, 'facilities');
          requireAssignee(ticket, user);
          requireStatus(ticket, ['accepted'], 'เรื่องนี้ไม่ได้อยู่ระหว่างดำเนินการ');
          // รูปหลังซ่อมไม่บังคับ (บางจุดถ่ายยาก/เครื่องไม่มีกล้อง) มีรูปผู้แจ้งเทียบก่อน/หลังได้
          if (body.photoBase64) ticket.afterPhotoUrl = saveJpeg(body.photoBase64, `ticket-${ticket.id}-after.jpg`, 'รูปหลังซ่อม');
          ticket.status = 'done';
          ticket.note = text(body.note, 1, 300);
          addEvent(ticket, 'done', user.id, ticket.note);
          notifyTicket(
            watchers(ticket),
            ticket,
            'ซ่อมเสร็จแล้ว ช่วยยืนยันหน่อย',
            `${ticket.title} · ${body.photoBase64 ? 'ดูรูปหลังซ่อมแล้วกดยืนยัน' : 'ตรวจแล้วกดยืนยัน'}`,
          );
          break;
        }

        // ผู้แจ้งยืนยันว่าเรียบร้อยจริง
        case 'confirm': {
          requireReporter(ticket, user);
          requireStatus(ticket, ['done'], 'ยืนยันได้หลังผู้รับเรื่องกดเสร็จแล้ว');
          ticket.status = 'confirmed';
          addEvent(ticket, 'confirmed', user.id);
          notifyTicket([ticket.assigneeId], ticket, 'ผู้แจ้งยืนยันว่าซ่อมเรียบร้อย', ticket.title);
          break;
        }

        // ผู้แจ้งบอกว่ายังไม่เรียบร้อย → กลับไปให้คนเดิมทำต่อ
        case 'reopen': {
          requireReporter(ticket, user);
          requireStatus(ticket, ['done'], 'เปิดเรื่องใหม่ได้หลังผู้รับเรื่องกดเสร็จแล้ว');
          const note = text(body.note, 3, 300);
          if (!note) throw invalid('กรุณาบอกว่ายังไม่เรียบร้อยตรงไหน', { note: 'กรุณาระบุเหตุผล' });
          ticket.status = 'accepted';
          addEvent(ticket, 'reopened', user.id, note);
          notifyTicket([ticket.assigneeId], ticket, 'ผู้แจ้งบอกว่ายังไม่เรียบร้อย', `${ticket.title}: ${note}`);
          break;
        }

        // เจ้าหน้าที่ปฏิเสธ (เช่น ไม่ใช่ความรับผิดชอบของวิทยาเขต) ต้องบอกเหตุผล
        case 'reject': {
          requireStaff(user, 'facilities');
          // เหมือน accept: ปฏิเสธเรื่องที่ตัวเองแจ้งไม่ได้ และเรื่องที่คนอื่นรับไปแล้วเป็นของคนนั้น
          if (ticket.reporterId === user.id) throw new HttpError(403, 'forbidden', 'ปฏิเสธเรื่องของตัวเองไม่ได้');
          if (ticket.assigneeId && ticket.assigneeId !== user.id) throw new HttpError(403, 'forbidden', 'เฉพาะผู้ที่รับเรื่องนี้');
          requireStatus(ticket, OPEN_STATES, 'เรื่องนี้ปิดไปแล้ว');
          const note = text(body.note, 3, 300);
          if (!note) throw invalid('กรุณาระบุเหตุผล', { note: 'กรุณาระบุเหตุผล' });
          ticket.status = 'rejected';
          ticket.note = note;
          addEvent(ticket, 'rejected', user.id, note);
          notifyTicket(watchers(ticket), ticket, 'เรื่องแจ้งซ่อมไม่ได้รับการดำเนินการ', `${ticket.title}: ${note}`);
          break;
        }

        // ผู้แจ้งยกเลิกเอง (เช่น แก้ได้เองแล้ว)
        case 'cancel': {
          requireReporter(ticket, user);
          requireStatus(ticket, OPEN_STATES, 'ยกเลิกได้เฉพาะเรื่องที่ยังไม่เสร็จ');
          ticket.status = 'cancelled';
          addEvent(ticket, 'cancelled', user.id);
          if (ticket.assigneeId) notifyTicket([ticket.assigneeId], ticket, 'ผู้แจ้งยกเลิกเรื่องแล้ว ไม่ต้องไป');
          break;
        }

        default:
          throw new HttpError(404, 'not_found', 'ไม่พบ endpoint นี้');
      }
      persist();
      send(res, 200, publicTicket(ticket, user));
      return true;
    }

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
