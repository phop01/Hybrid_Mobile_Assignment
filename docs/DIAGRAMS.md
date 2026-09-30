# แผนภาพการทำงานของ KKUNK Today

## 1. แผนผังหน้าจอ (Expo Router)

แท็บหลัก 6 หน้าอยู่ใน `(tabs)` (แท็บ "กิจกรรม" ของนักศึกษาเปลี่ยนเป็น "จัดการ" สำหรับเจ้าหน้าที่) หน้ารายละเอียดและฟอร์มอยู่ใน Root Stack จึงมีปุ่มย้อนกลับอัตโนมัติ
หน้าที่มีกุญแจ 🔒 ต้อง Login ก่อน (`Stack.Protected`)

```mermaid
flowchart LR
  subgraph Tabs["แท็บหลัก (tabs)"]
    T["วันนี้<br>/"]
    A["กิจกรรม / จัดการ<br>/activities, /manage"]
    K["เรื่องแจ้ง<br>/tickets"]
    MP["แผนที่<br>/map"]
    I["แจ้งเตือน<br>/inbox"]
    P["ฉัน<br>/profile"]
  end
  T --> KN["🔒 แจ้งเรื่อง (3 ขั้น)<br>/tickets/new"]
  K --> KN
  K --> KD["🔒 รายละเอียดเรื่อง<br>/tickets/[id]"]
  KN --> KD
  KD --> KF["🔒 แจ้งว่าเสร็จ (+ รูปหลังซ่อม)<br>/tickets/[id]/done"]
  MP -->|"แตะหมุด → การ์ด"| KD
  I -->|"แตะรายการ"| KD
  N(["แตะแจ้งเตือน / nktoday://tickets/id"]) --> KD
  T --> B["🔒 ส่งประกาศ (เจ้าหน้าที่)<br>/broadcast/new"]
  A --> D["รายละเอียดกิจกรรม<br>/activities/[id]"]
  D --> R["🔒 ลงทะเบียน"] --> G["🔒 การลงทะเบียน<br>/registrations/[id]"] --> C["🔒 เช็กอิน"]
  P --> W["เนื้อหา W1–14<br>/about"]
```

## 2. วงจรของเรื่องแจ้งซ่อม

```mermaid
stateDiagram-v2
  [*] --> open: แจ้งซ่อม (รูป + หมุด)
  open --> accepted: เจ้าหน้าที่อาคารรับเรื่อง (+ นัดเวลา)
  accepted --> open: คืนเรื่อง
  accepted --> done: ทำเสร็จ (+ รูปหลังซ่อม ถ้ามี)
  done --> confirmed: ผู้แจ้งยืนยัน
  done --> accepted: ยังไม่เรียบร้อย + เหตุผล
  open --> rejected: เจ้าหน้าที่ปฏิเสธ + เหตุผล
  accepted --> rejected
  open --> cancelled: ผู้แจ้งยกเลิก
  accepted --> cancelled
  confirmed --> [*]
```

## 3. กล่องแจ้งเตือน: อีกฝั่งกด → เครื่องนี้เด้ง

```mermaid
sequenceDiagram
  actor S as นักศึกษา (มือถือ)
  participant API as server
  actor O as เจ้าหน้าที่ (เว็บ)
  S->>API: POST /tickets (แจ้งซ่อม + รูป + พิกัด)
  API->>API: notify(เจ้าหน้าที่ทุกคน)
  O->>API: GET /me/inbox?since=… (ทุก 8 วิ)
  API-->>O: "แจ้งซ่อมใหม่: …" → แถบแจ้งเตือนบนเว็บ
  O->>API: POST /tickets/:id/accept {appointmentAt}
  API->>API: ตรวจบทบาท (403) + สถานะ (409) → notify(ผู้แจ้ง + คนที่เจอเหมือนกัน)
  S->>API: GET /me/inbox?since=…
  API-->>S: "เจ้าหน้าที่รับเรื่องแล้ว · นัดเข้าซ่อม …"
  S->>S: presentInboxItem → แจ้งเตือนในเครื่อง + ตั้งเตือนก่อนนัด 1 ชม.
  S->>S: แตะแจ้งเตือน → targetFor(kind, id) → /tickets/[id]
```

## 4. ชั่วโมงกิจกรรม/จิตอาสา: มาจากการเข้าร่วมกิจกรรมเท่านั้น

```mermaid
sequenceDiagram
  actor S as นักศึกษา
  participant API as server
  actor O as เจ้าหน้าที่งานกิจกรรม
  S->>API: POST /registrations/:id/check-in (ตำแหน่ง + รูป หรือรูปใบเซ็นชื่อ)
  API-->>S: checked_in (เช็กอินในแอป) หรือ pending_review (ใบเซ็นชื่อ)
  API-->>O: (inbox) "มีหลักฐานรอตรวจ"
  O->>API: POST /registrations/:id/review ผ่าน / ไม่ผ่าน + เหตุผล
  API-->>S: (inbox) ผลตรวจ
  S->>S: summarizeAttendance → ชั่วโมงรวม + แยกหมวด (จิตอาสา = กิจกรรมหมวดจิตอาสา)
```

---

# ส่วนกิจกรรมและเช็กอิน

## 5. ขั้นตอนเช็กอิน

ตรวจตามลำดับที่ผู้ใช้ควรรู้ก่อน: สถานะ → เวลา → ตำแหน่ง → รูป (`src/lib/check-in-rules.ts`)
server ตรวจเวลาและระยะทางซ้ำอีกรอบ เพราะค่าที่ส่งจากแอปแก้ไขได้

```mermaid
flowchart TD
  start(["กดเช็กอิน"]) --> st{"ลงทะเบียนอยู่<br>และยังไม่ส่งหลักฐาน?"}
  st -->|"ไม่"| x1["แจ้งว่าส่งแล้ว / ถูกยกเลิก"]
  st -->|"ใช่"| t{"อยู่ในช่วงเวลา?<br>ก่อนงาน 30 นาที ถึงจบงาน"}
  t -->|"ไม่"| x2["แจ้งว่ายังไม่ถึงเวลา / หมดเวลา"]
  t -->|"ใช่"| loc{"ได้สิทธิ์ตำแหน่ง?"}
  loc -->|"ไม่"| x3["อธิบายเหตุผล + ปุ่มขอสิทธิ์ใหม่ / เปิด Settings"]
  loc -->|"ได้"| r{"อยู่ในรัศมีงาน?"}
  r -->|"ไม่"| x4["แสดงระยะห่าง เช่น 2.3 กม. ✗"]
  r -->|"ใช่"| cam["ถ่ายรูปสด หรือเลือกจากคลัง<br>(รูปจากคลังต้องถ่ายระหว่างงาน)"]
  cam --> send{"ส่งถึง server?"}
  send -->|"ออฟไลน์"| q["เก็บเข้าคิวใน SQLite<br>ส่งให้อัตโนมัติเมื่อมีเน็ต"]
  send -->|"ส่งได้"| m{"วิธีเช็กชื่อของกิจกรรม"}
  m -->|"เช็กอินในแอป"| ok["เข้าร่วมแล้ว<br>นับในโปรไฟล์ทันที"]
  m -->|"ใบเซ็นชื่อกระดาษ"| pr["รอผู้จัดตรวจ"] --> v["ตรวจผ่าน → แจ้งเตือน + นับในโปรไฟล์"]
```

## 6. วงจรการแจ้งเตือนของกิจกรรม

```mermaid
sequenceDiagram
  actor U as ผู้ใช้
  participant App as แอป
  participant OS as ระบบของมือถือ
  U->>App: กด "แจ้งเตือนเมื่อเปิดเช็กอิน"
  App->>OS: ขอสิทธิ์แจ้งเตือน (ครั้งแรก) + สร้าง Android channel
  App->>OS: ตั้งเวลาแจ้งเตือน ข้อมูลในแจ้งเตือนมีแค่ registrationId
  Note over OS: ถึงเวลา 30 นาทีก่อนงาน<br>แอปจะเปิดอยู่ อยู่เบื้องหลัง หรือปิดอยู่ก็ได้
  OS->>U: แสดงแจ้งเตือน
  U->>OS: แตะแจ้งเตือน
  OS->>App: เปิดแอป (cold start) หรือส่ง response
  App->>App: ตรวจรูปแบบ ID แล้วเปิด /check-in/[registrationId]
  App->>App: โหลดข้อมูลล่าสุด ไม่เชื่อข้อมูลในแจ้งเตือน
```

### 3.1 ประกาศจากผู้จัด (ไม่ต้องมี push server)

```mermaid
sequenceDiagram
  actor O as ผู้จัด (เว็บ)
  participant API as API server
  participant App as แอปนักศึกษา
  participant OS as ระบบของมือถือ
  O->>API: POST /activities/:id/announcements {message}
  API->>API: ตรวจว่าเป็นผู้จัดของกิจกรรมนี้ + ความยาว 1–200
  loop ทุก 15 วินาทีขณะแอปเปิดอยู่ + ทุกครั้งที่กลับเข้าแอป
    App->>API: GET /announcements (เฉพาะกิจกรรมที่ฉันลงทะเบียน)
    API-->>App: รายการประกาศ
    App->>App: เทียบกับ id ที่เคยเห็น (เก็บในเครื่อง)
    App->>OS: แสดงแจ้งเตือนในเครื่อง "ประกาศ: ชื่อกิจกรรม"
  end
  OS->>App: แตะแจ้งเตือน → เปิด /activities/[id]
```

## 7. การอ่านข้อมูลแบบออฟไลน์ก่อน (offline-first)

```mermaid
flowchart LR
  open(["เปิดหน้ารายการ"]) --> c["แสดงข้อมูลในเครื่องทันที"]
  c --> api{"เรียก API"}
  api -->|"สำเร็จ"| fresh["แสดงข้อมูลใหม่ + บันทึกลงเครื่อง"]
  api -->|"ติดต่อไม่ได้ + มีข้อมูลในเครื่อง"| off["แสดงข้อมูลเดิม + แถบออฟไลน์พร้อมเวลาอัปเดตล่าสุด"]
  api -->|"ติดต่อไม่ได้ + ไม่มีข้อมูลในเครื่อง"| err["หน้าข้อผิดพลาด + ปุ่มลองใหม่"]
```

## ฝั่งผู้จัดกิจกรรมและการตรวจหลักฐาน (Final)

```mermaid
sequenceDiagram
  actor S as นักศึกษา
  participant App as แอป (นักศึกษา)
  participant API as API server
  participant O as แอป (ผู้จัด)
  O->>API: POST /activities (role = organizer เท่านั้น)
  S->>App: ลงทะเบียน + ถ่ายรูปใบเซ็นชื่อ
  App->>API: POST /registrations/:id/check-in
  API-->>App: status = pending_review
  loop ทุก 10 วินาทีขณะเปิดหน้า
    O->>API: GET /activities/:id/attendees
  end
  O->>API: POST /registrations/:id/review {approve:false, note}
  App->>API: GET /registrations (ทุก 5 วินาทีขณะรอตรวจ)
  App-->>S: แจ้งเตือน "หลักฐานไม่ผ่าน: เหตุผล"
  S->>App: ส่งหลักฐานใหม่
  O->>API: review {approve:true}
  App-->>S: แจ้งเตือน "ตรวจผ่านแล้ว" + ชั่วโมงเพิ่ม
```

## แท็บตาม role

```mermaid
flowchart LR
  Login{"role"} -->|student| ST["กิจกรรม · แผนที่ · ของฉัน · บันทึกไว้ · โปรไฟล์(ชั่วโมง)"]
  Login -->|organizer| OR["กิจกรรม · แผนที่ · จัดการ · บันทึกไว้ · โปรไฟล์"]
  OR --> N["🔒 organizer/new สร้างกิจกรรม"]
  OR --> R["🔒 organizer/[id] รายชื่อ + ตรวจหลักฐาน"]
```
