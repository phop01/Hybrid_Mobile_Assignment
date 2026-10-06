# แผนภาพการทำงานของ KKUNK Today

## 1. แผนผังหน้าจอ (Expo Router)

แท็บหลัก 5 หน้าอยู่ใน `(tabs)` (หน้า "วันนี้" รวมรายการกิจกรรม · แท็บ "บันทึกไว้" ของนักศึกษาเปลี่ยนเป็น "จัดการ" สำหรับเจ้าหน้าที่) หน้ารายละเอียดและฟอร์มอยู่ใน Root Stack จึงมีปุ่มย้อนกลับอัตโนมัติ
หน้าที่มีกุญแจ 🔒 ต้อง Login ก่อน (`Stack.Protected`)

```mermaid
flowchart LR
  subgraph Tabs["แท็บหลัก (tabs)"]
    T["วันนี้ + กิจกรรมทั้งหมด<br>/"]
    A["บันทึกไว้ / จัดการ<br>/saved, /manage"]
    MP["แผนที่<br>/map"]
    I["แจ้งเตือน<br>/inbox"]
    P["ฉัน<br>/profile"]
  end
  N(["แตะแจ้งเตือน / nktoday://activities/id"]) --> D
  I -->|"แตะรายการ"| G
  MP -->|"แตะหมุด → การ์ด"| D
  T --> D["รายละเอียดกิจกรรม<br>/activities/[id]"]
  A --> D
  D --> R["🔒 ลงทะเบียน"] --> G["🔒 การลงทะเบียน<br>/registrations/[id]"] --> C["🔒 เช็กอิน"]
  P --> W["เนื้อหา W1–14<br>/about"]
```

## 2. วงจรสถานะการลงทะเบียน (หลักฐานการเข้าร่วม)

```mermaid
stateDiagram-v2
  [*] --> registered: ลงทะเบียน
  registered --> pending_review: ส่งหลักฐาน (รูป + พิกัด)
  pending_review --> checked_in: เจ้าหน้าที่ตรวจผ่าน → นับชั่วโมง
  pending_review --> registered: เจ้าหน้าที่ไม่ผ่าน + เหตุผล (ส่งใหม่ได้)
  registered --> rejected: เจ้าหน้าที่ไม่รับการลงทะเบียน + เหตุผล
  registered --> cancelled: นักศึกษายกเลิก / เจ้าหน้าที่ยกเลิกกิจกรรม
  pending_review --> cancelled
  checked_in --> [*]
```

## 3. กล่องแจ้งเตือน: อีกฝั่งกด → เครื่องนี้เด้ง

```mermaid
sequenceDiagram
  actor S as นักศึกษา (มือถือ)
  participant API as server
  actor O as เจ้าหน้าที่กิจกรรม (เว็บ)
  S->>API: POST /registrations/:id/check-in (รูป + พิกัด)
  API->>API: notify(เจ้าของกิจกรรม)
  O->>API: GET /me/inbox?since=… (ทุก 8 วิ)
  API-->>O: "มีหลักฐานรอตรวจ" → แถบแจ้งเตือนบนเว็บ
  O->>API: POST /registrations/:id/review {approve}
  API->>API: ตรวจบทบาท (403) + สถานะ (409) → notify(นักศึกษา)
  S->>API: GET /me/inbox?since=…
  API-->>S: "หลักฐานผ่านแล้ว · ได้ N ชั่วโมง"
  S->>S: presentInboxItem → แจ้งเตือนในเครื่อง
  S->>S: แตะแจ้งเตือน → targetFor(kind, id) → /registrations/[id]
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
  Login{"role"} -->|student| ST["วันนี้ · บันทึกไว้ · แผนที่ · แจ้งเตือน · ฉัน(ชั่วโมง)"]
  Login -->|organizer| OR["วันนี้ · จัดการ · แผนที่ · แจ้งเตือน · ฉัน"]
  OR --> N["🔒 organizer/new สร้างกิจกรรม"]
  OR --> R["🔒 organizer/[id] รายชื่อ + ตรวจหลักฐาน"]
```
