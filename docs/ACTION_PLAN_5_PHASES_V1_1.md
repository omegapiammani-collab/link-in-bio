# Action Plan 5 เฟส ตาม Project Scope Baseline v1.1

วันที่จัดทำ: 9 พฤศจิกายน 2569  
สถานะ: ร่างสำหรับทบทวน  
แหล่งข้อกำหนด: Project Scope Baseline v1.1 ที่ Owner ส่งในบทสนทนา, ลงวันที่ 3 พฤศจิกายน 2569, สถานะในเอกสารคือรออนุมัติ

## ขอบเขตการตัดสินใจ

Baseline หัวข้อ 18 ระบุชื่อและผลลัพธ์ระดับเฟส แต่ยังไม่มี SRS, Architecture, Schema และ Action Plan ฉบับละเอียด หัวข้อ 19 ระบุว่าการอนุมัติ Baseline อนุญาตให้จัดทำเอกสารเหล่านี้ แต่ยังไม่ใช่คำสั่งเริ่มเขียนโค้ด สร้างฐานข้อมูล หรือ Deploy คำขอให้จัดทำแผนนี้จึงใช้เป็นสิทธิ์สำหรับงานเอกสารและการตรวจสถานะเท่านั้น จนกว่า Owner จะยืนยันสถานะอนุมัติและขอบเขตงานลงมือทำ

ข้อห้ามที่ยังมีผล: ไม่ merge เข้า `main`, ไม่แก้ Production, ไม่ Deploy, ไม่เปิด Draft Write, Publish หรือ Public Read บนระบบที่โฮสต์, และไม่ใช้บริการเสียเงิน การพัฒนาและทดสอบที่ได้รับอนุญาตเดิมอยู่บน `feature/phase-2-editor-foundation` และ CI แยกชั่วคราวเท่านั้น

ชื่อ Phase ใน repository เป็นแผนรุ่นก่อน ไม่ใช่เลข Phase ของ Baseline นี้ งานที่ repository เรียก `Phase 2 — Profile and Link Editor` จัดอยู่ใน Baseline Phase 3 เป็นหลัก บางส่วนเป็น Phase 1 และ 2 ห้ามใช้ชื่อเหมือนกันเป็นหลักฐานว่า Baseline Phase 2 ผ่านแล้ว

## ภาพรวมสถานะที่ตรวจจาก source

| Baseline | หลักฐานใน repository | สถานะตาม Baseline |
| --- | --- | --- |
| 1 Foundation & Security | `supabase/migrations/0001`–`0009`, `src/lib/auth/owner.ts`, Google callback, CI Auth/RLS/Storage; รายงาน release gate ระบุการทดสอบ Google ของ Preview เดิม | มีฐาน แต่ยังไม่ปิดเกณฑ์ Google/Recovery/hosted parity |
| 2 Public View & Rendering | `src/app/[slug]/page.tsx` แสดงชื่อ คำอธิบาย และ Link จาก published RPC เมื่อเปิด flag; `src/lib/domain/rules.mjs` มี schedule utility | ยังไม่มี 6 บล็อก, Theme, Embed, Social, Schedule ใน renderer; Public Read ยังปิด |
| 3 Admin Editor & Publishing | `/admin/pages`, `/admin/editor`, draft API, audited SQL, immutable publish core, CI Owner/Non-Owner | มี page list และ Link editor บางส่วน; ยังไม่มี editor 6 บล็อก, appearance, autosave, rollback UI, trash lifecycle |
| 4 Localization & Enhancements | ภาษาไทยใน UI บางจุด, slug validation ใน schema | ยังไม่มี `/en/[slug]`, per-field fallback, QR, redirect, เกณฑ์ accessibility/performance |
| 5 Testing, Backup & Deployment | CI unit/integration/browser, backup scripts, `docs/HOSTING_SPIKE.md` | CI แยกชั่วคราวมีหลักฐาน; hosted recovery, monitoring, Cloudflare/Netlify comparison และ release gate ยังไม่ครบ |

สถานะนี้เป็นการประเมิน source ในสาขา Draft ไม่ใช่การรับรอง Production เอกสารก่อนหน้ามีข้อความบางส่วนที่เขียนก่อนการทดสอบและการตั้งค่า test environment ในภายหลัง ให้ตรวจหลักฐานล่าสุดตามวันและ commit ก่อนยกระดับสถานะ

## Phase 0: เอกสารออกแบบที่ต้องตกลงก่อน implementation

1. Owner ยืนยันว่า Baseline v1.1 ผ่านการอนุมัติหรือแก้ไขรายการที่ยังไม่ตกลง โดยเฉพาะ Public/Unlisted, การลบและกู้คืน 30 วัน, backup จริง, และ hosting ฟรี
2. จัดทำ SRS ที่ให้ requirement ID, flow ของ Owner/Visitor, error/failure state, threat cases, acceptance test ต่อ requirement และนิยาม `done` ที่วัดได้
3. จัดทำ System Architecture ที่แยก Auth, Admin API, immutable published snapshot, public renderer, media, cache และ backup พร้อม data flow และ trust boundary
4. จัดทำ Database Schema ฉบับเป้าหมายโดยเทียบกับ migrations 0001–0009 ก่อนออก migration เพิ่ม ครอบคลุม block content, translations, schedules, slug redirects, recycle bin, retention และ audit
5. ตกลง release matrix แยก source/CI, isolated hosted Test, Preview และ Production พร้อมรายชื่อ flag/database switch ที่ต้องปิดตามค่าเริ่มต้น

เกณฑ์ผ่าน: Owner ตรวจและอนุมัติ SRS, Architecture, Schema และ Action Plan ที่ระบุ dependencies, acceptance criteria และข้อยกเว้นที่เหลือ ไม่มี code, migration หรือ hosted setting ใหม่อ้างอิงเอกสารที่ยังไม่ผ่าน

## Phase 1: Foundation & Security

**ลำดับงาน**

1. ตรวจ Google OAuth callback และการผูก Owner กับ Google `sub`/Supabase Auth ID สำหรับบัญชีเดียว กำหนดวิธีเปลี่ยน Owner ที่มีการตรวจสอบ
2. ทบทวน RLS และ privilege ของตาราง, RPC และ Storage ด้วย Owner, Non-Owner, anonymous และ token ผิดรูปแบบ รวมการปฏิเสธเมื่อ flag ปิด
3. ตรวจ schema จริงกับ SRS: หน้าหลายหน้า, slug สงวน, draft/version, blocks, media, audit, backup; ออก migration เพิ่มเฉพาะ gap ที่ผ่านการทบทวน
4. ทบทวน URL/XSS/embed/file checks, request limits, secret handling และ rate limit ตาม boundary ของแต่ละ API
5. กำหนดการ bootstrap Owner บน test project และขั้นตอนกู้คืนที่ไม่เปิดสิทธิ์บัญชีอื่นโดยอัตโนมัติ

**พึ่งพา:** Phase 0; test identity และ test origin ที่ Owner อนุญาตสำหรับ Google OAuth จริง

**เกณฑ์รับงาน:** Google Owner เข้า Admin ได้และ Non-Owner ถูกปฏิเสธด้วยบัญชีจริงบน test origin; CI ตรวจ RLS/Storage/API แบบ Owner/Non-Owner/anonymous; ไม่พบช่องทางเขียนหรืออ่านข้อมูลหลังบ้านขณะ flag ปิด; migration ทำงานและ rollback ได้ในสภาพแวดล้อมแยก; มีหลักฐานการจัดเก็บ secrets และ free-tier quotas

**หลักฐานปัจจุบัน:** `docs/PHASE1_ACCEPTANCE_GATES.md`, `docs/PHASE2_RELEASE_GATES.md`, `tests/next-http-e2e.mjs` ระบุ CI ด้วย synthetic GoTrue users และ manual OAuth บน Preview เดิม งานจริงกับ Phase 2 test origin ยังเป็นเกณฑ์เปิด

## Phase 2: Public View & Rendering

**ลำดับงาน**

1. ระบุ immutable snapshot contract สำหรับ profile, 6 block types, theme, social icons, visibility, schedule และภาษา โดยไม่ส่ง draft/audit/secret ไปฝั่ง public
2. สร้าง renderer ของ Link, Header, Divider, Embed, Image, Text ตามลำดับ พร้อม schema validation และ output encoding; block ที่ปิดหรือยังไม่ถึงเวลาไม่เผย URL หรือ payload ผ่าน public API
3. แปลง URL ของ YouTube, Spotify, TikTok, Vimeo, SoundCloud, Apple Music เป็น embed ที่อนุญาตแบบ allowlist ไม่รับ HTML/JavaScript อิสระ
4. เพิ่ม preset และ config ของ Theme, avatar/background, fonts, social icons, reduced motion และ mobile layout; ใช้ media ที่ปลอดภัยสำหรับ public snapshot ไม่ใช้ private signed URL เป็น URL ถาวร
5. ทดสอบ schedule ด้วย UTC storage, Asia/Bangkok input/output, boundary times, tab ที่เปิดค้าง, clock ไม่เชื่อถือได้ และ cache fallback แบบซ่อน scheduled block เมื่อไม่อาจพิสูจน์เวลา
6. พิสูจน์ Public/Unlisted semantics, การไม่จัดทำดัชนี Unlisted และข้อจำกัด cache ด้วย isolated tests ก่อนเปิด public flag ใด ๆ

**พึ่งพา:** Phase 1 ผ่านข้อกำหนดข้อมูลและ security; snapshot/schema ใน Phase 0 อนุมัติ

**เกณฑ์รับงาน:** ตัวอย่างครบ 6 บล็อกและ 4 ธีมแสดงถูกต้องบนมือถือ/desktop; embed URL อันตรายถูกปฏิเสธ; scheduled block ไม่รั่วผ่าน HTTP/HTML/API/cache; anonymous เห็นเฉพาะ published Public snapshot, Unlisted ตาม URL ที่ทราบและนโยบายที่กำหนด; draft ไม่รั่ว; มี integration และ browser tests ที่ใช้ API จริงใน CI แยก

**สถานะ:** renderer ปัจจุบันแสดงเพียง profile text และ Links ภายใต้ `PHASE2_PUBLIC_RENDER_ENABLED`; ยังไม่ผ่านเกณฑ์ Phase 2 นี้

## Phase 3: Admin Editor & Publishing

**ลำดับงาน**

1. จัดการ page lifecycle: create/edit, slug conflict, visibility, archive, trash, restore ภายใน 30 วัน และการลบหลังหมดอายุโดยมี audit
2. ทำ editor ของ 6 บล็อก: เพิ่ม/แก้/duplicate/ลบ, reorder ด้วย keyboard และ drag/drop, collapse/expand, toggle, schedules, animation, Thai/English fields
3. ทำ Appearance editor และ live preview ที่ใช้ renderer contract เดียวกับ published view; desktop สองฝั่ง, mobile สลับแท็บ, draft/published switch
4. เพิ่ม autosave ที่มี revision/CAS, debounce, dirty/saving/saved/conflict/error states และ reload/retry ที่ไม่ทับงานเก่า
5. ทำ Publish และ Rollback แบบ atomic, immutable version, audit, confirmation และ fail-closed gate; ทดสอบพร้อมกันหลายคำขอและ forced failure

**พึ่งพา:** Phase 1 identity/RLS, Phase 2 snapshot contract และ renderer, schema ที่รองรับ recycle bin/versions

**เกณฑ์รับงาน:** Owner ทำ flow เต็มได้ใน CI แยก, Non-Owner/anonymous ถูกปฏิเสธทุก mutation, refresh เก็บ draft ได้, 409 conflict ไม่สูญข้อมูล, failed transaction ไม่เหลือ partial rows, rollback สร้าง version ใหม่โดยไม่แก้ snapshot เก่า, public snapshot ไม่เปลี่ยนจน Publish สำเร็จ; flag บน hosted environment ยังปิดจนได้รับอนุญาตแยก

**สถานะ:** Owner Page List read-only, Link draft, guarded create/save และ SQL publish foundation มีแล้วใน source; ยังไม่ใช่ editor หรือ publishing ครบ Baseline

## Phase 4: Localization & Enhancements

**ลำดับงาน**

1. เพิ่ม route `/[slug]` ภาษาไทยและ `/en/[slug]` ภาษาอังกฤษ พร้อมสลับภาษา; fallback ภาษาไทยเฉพาะ field ที่ขาด และ UI Admin สองภาษา
2. เพิ่ม slug history และ redirect ที่รักษาเส้นทาง TH/EN, ไม่วนซ้ำ, ไม่ชน reserved route, ไม่เปิดข้อมูลของหน้า archived/trashed
3. เพิ่ม QR ต่อหน้า, ดาวน์โหลด PNG และคัดลอก URL ที่สะท้อน canonical public URL
4. ตรวจ responsive, keyboard, screen reader, focus, contrast, reduced motion และ alt text ทั้ง editor/public
5. วัด p75 LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 บน public view; แยกผลสื่อภายนอกออกจากเนื้อหาหลักตามเงื่อนไข SRS และแก้ regression

**พึ่งพา:** Phase 2 renderer และ Phase 3 editor ที่รับ bilingual content

**เกณฑ์รับงาน:** E2E TH/EN/fallback/redirect/QR ผ่าน; keyboard และ screen reader flows ผ่านรายการตรวจ; รายงาน performance ระบุ device/network/sample size/p75 และ third-party embed แยกชัด

## Phase 5: Testing, Backup & Deployment

**ลำดับงาน**

1. ทำ requirement traceability จาก SRS ไป unit, integration, API, browser, security และ recovery tests; rerun CI บน commit สุดท้าย
2. เปรียบเทียบ Cloudflare กับ Netlify Free ด้วยเอกสารทางการที่เป็นปัจจุบันและ runtime spike เดียวกัน: Next.js compatibility, OAuth cookies, limits, performance, deploy/rollback, ราคา 0 บาท; บันทึกข้อดี/ข้อจำกัดและให้ Owner เลือก
3. ออกแบบและทดลอง backup รายสัปดาห์/ก่อนเปลี่ยนระบบ, เก็บ 4 ชุดนอก Supabase, ฐานข้อมูลและไฟล์จริง, encryption/checksum และ restore drill ที่มี Auth/Storage byte verification; บันทึก RPO ประมาณ 7 วันตาม Baseline
4. วาง retention audit 90 วัน, monitoring ของ auth/publish/failure, quota alert และ runbook สำหรับ rollback, restore, Owner transfer และ paused Free project
5. จัดทำคู่มือ Owner, checklist Go/No-Go, ผลการทดสอบ, known limitations และชุดส่งมอบ; ขออนุมัติ rollout เฉพาะเมื่อทุก gate ผ่าน

**พึ่งพา:** Phase 1–4 ผ่าน acceptance, hosting decision, ผู้ถือ secrets/backup destination และการอนุญาตแยกสำหรับ deployment

**เกณฑ์รับงาน:** CI ผ่านบน commit ที่ส่งมอบ; security review ไม่มีช่องเปิดที่ไม่ยอมรับ; offsite encrypted backup และ restore จริงผ่านพร้อมไฟล์อย่างน้อยหนึ่งไฟล์; free-tier limits และข้อจำกัด uptime บันทึกไว้; Owner ลงนาม Go/No-Go; deployment/Production ทำได้เฉพาะหลังเปลี่ยนข้อห้ามปัจจุบันโดยชัดแจ้ง

## งานถัดไปที่ทำได้ภายใต้ข้อห้ามปัจจุบัน

1. ให้ Owner ตรวจ Baseline v1.1 และแผนนี้ แล้วระบุว่ารับรองขอบเขตใด
2. จัดทำ SRS, Architecture และ Schema แบบร่างจาก Baseline พร้อม requirement IDs และ mapping ไป source ปัจจุบัน
3. ทบทวน test gaps และทำ CI แยกเฉพาะ read-only/ความปลอดภัยที่ไม่เปิด hosted flags หลังได้รับสิทธิ์เริ่ม implementation ตามหัวข้อ 19
4. คง Draft PR และ feature branch, ไม่ประกาศว่าทั้ง 5 เฟสเสร็จเพียงเพราะ CI เดิมผ่าน

## เรื่องที่ต้องตัดสินใจก่อนเดินเฟสเต็ม

- Baseline v1.1 ได้รับอนุมัติแล้วหรือยัง และให้เริ่ม implementation จาก SRS/Architecture/Schema ฉบับอนุมัติเมื่อใด
- ข้อห้ามเดิมยังใช้กับทุก environment หรือจะอนุญาตเฉพาะ isolated Test เป็นรายขั้น เช่น Google OAuth ทดสอบ, migration, flag และ deploy
- ที่เก็บ backup นอก Supabase/GitHub และผู้รับผิดชอบ secrets/retention
- Hosting จะตัดสินหลัง Cloudflare/Netlify Free spike ตาม Baseline; `docs/HOSTING_SPIKE.md` ที่ระบุ Cloudflare เป็น target ต้องถือเป็นข้อเสนอเดิม ไม่ใช่ผลเลือกตาม Baseline v1.1
