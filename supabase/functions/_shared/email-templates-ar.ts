// Arabic RTL email templates for Fuqah AI. HTML is the user-approved markup
// from fuqah-email-templates.html. Footer always: support@fuqah.ai · fuqah.ai.

const DASHBOARD_URL = "https://fuqah.ai";

const footer = `
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:16px;background:#f1f5f9;border-radius:8px"><tbody><tr><td align="center" style="padding:16px;text-align:center">
  <p style="margin:0 0 10px;color:rgb(51,65,85);font-size:13px;font-weight:600">هل تحتاج مساعدة؟</p>
  <p style="margin:0">🌐 <a href="https://fuqah.ai" style="color:rgb(59,130,246);text-decoration:none;font-size:12px;margin:0 8px" target="_blank">fuqah.ai</a> 📧 <a href="mailto:support@fuqah.ai" style="color:rgb(59,130,246);text-decoration:none;font-size:12px;margin:0 8px" target="_blank">support@fuqah.ai</a></p>
</td></tr></tbody></table>`;

const simpleFooter = `
<tr><td align="center" style="padding:20px;background:#f8fafc;border-radius:0 0 16px 16px;text-align:center;border-top:1px solid #e5e7eb">
  <p style="margin:0 0 8px;color:rgb(107,114,128);font-size:12px">🌐 <a href="https://fuqah.ai" style="color:rgb(30,58,95);text-decoration:none" target="_blank">fuqah.ai</a></p>
  <p style="margin:0;color:rgb(107,114,128);font-size:12px">📧 للدعم الفني: <a href="mailto:support@fuqah.ai" style="color:rgb(30,58,95);text-decoration:none" target="_blank">support@fuqah.ai</a></p>
</td></tr>`;

function esc(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function welcomeHtml(v: {
  store_name: string;
  email: string;
  package_name: string;
  expires_at: string;
  password: string;
  conversations_count: string;
  characters_count: string;
}): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="background-color:#ffffff;margin:0;padding:0;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif">
<table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center"><tbody><tr><td style="background:#ffffff">
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(37,99,235,0.1)"><tbody>
<tr><td align="center" style="padding:28px 20px;background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);text-align:center">
  <div style="font-size:36px;margin-bottom:12px">🎉</div>
  <h1 style="margin:0 0 6px;color:#fff;font-size:22px;font-weight:bold">تم تفعيل اشتراكك بنجاح!</h1>
  <p style="margin:0;color:rgba(255,255,255,0.9);font-size:14px">مرحباً بك في منصة فقاعة AI</p>
</td></tr>
<tr><td style="padding:28px 20px">
  <p style="margin:0 0 12px;color:#1e3a5f;font-size:18px;font-weight:bold">مرحباً ${esc(v.store_name)} 👋</p>
  <p style="margin:0 0 24px;color:#4b5563;font-size:14px;line-height:1.7">يسعدنا إعلامك بأن اشتراكك قد تم تفعيله بنجاح في منصة <strong>فقاعة AI</strong>!</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;padding:16px;background:#eff6ff;border-radius:10px;border:1px solid #bfdbfe"><tbody><tr><td style="padding:16px">
    <p style="margin:0 0 14px;color:#1e40af;font-size:15px;font-weight:bold">📋 تفاصيل حسابك</p>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody>
      <tr><td style="padding:8px 0;border-bottom:1px solid rgba(59,130,246,0.2)"><p style="margin:0"><span style="color:#6b7280">البريد الإلكتروني</span><br/>${esc(v.email)}</p></td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid rgba(59,130,246,0.2)"><p style="margin:0"><span style="color:#6b7280">نوع الباقة</span><br/>${esc(v.package_name)}</p></td></tr>
      <tr><td style="padding:8px 0"><p style="margin:0"><span style="color:#6b7280">تاريخ انتهاء الاشتراك</span><br/>${esc(v.expires_at)}</p></td></tr>
    </tbody></table>
  </td></tr></tbody></table>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#fef3c7;border:2px solid #f59e0b;border-radius:8px"><tbody><tr><td align="center" style="padding:14px;text-align:center">
    <p style="margin:0 0 6px;color:#92400e;font-size:12px">🔐 كلمة المرور الخاصة بك</p>
    <p style="margin:0 0 6px;color:#78350f;direction:ltr;font-family:monospace;font-size:20px;font-weight:bold;letter-spacing:1px">${esc(v.password)}</p>
    <p style="margin:0;color:#b45309;font-size:11px">⚠ ننصحك بتغيير كلمة المرور بعد أول تسجيل دخول</p>
  </td></tr></tbody></table>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px"><tbody><tr>
    <td align="center" style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:center">
      <div style="font-size:24px;margin-bottom:6px">💬</div>
      <p style="margin:0;color:#1e40af;font-size:18px;font-weight:bold">${esc(v.conversations_count)}</p>
      <p style="margin:4px 0 0;color:#6b7280;font-size:11px">محادثة شهرياً</p></td>
    <td style="padding:0;width:8px"></td>
    <td align="center" style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:center">
      <div style="font-size:24px;margin-bottom:6px">📝</div>
      <p style="margin:0;color:#1e40af;font-size:18px;font-weight:bold">${esc(v.characters_count)}</p>
      <p style="margin:4px 0 0;color:#6b7280;font-size:11px">حرف متاح</p></td>
  </tr></tbody></table>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px"><tbody><tr><td align="center" style="text-align:center">
    <a href="${DASHBOARD_URL}" style="color:#fff;text-decoration:none;background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);border-radius:8px;display:inline-block;font-size:15px;font-weight:bold;padding:12px 32px" target="_blank">🚀 الدخول إلى لوحة التحكم</a>
  </td></tr></tbody></table>
  ${footer}
</td></tr>
<tr><td align="center" style="padding:20px;background:#1e3a5f;text-align:center">
  <p style="margin:0 0 8px;color:#fff;font-size:18px;font-weight:bold">فقاعة AI 🤖</p>
  <p style="margin:0 0 12px;color:rgba(255,255,255,0.7);font-size:12px">شكراً لثقتك بنا!</p>
  <p style="margin:0;border-top:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:10px;padding-top:12px">© 2025 فقاعة AI</p>
</td></tr>
</tbody></table>
</td></tr></tbody></table>
</body></html>`;
}

export function ticketReceivedHtml(v: {
  store_name: string;
  ticket_number: string;
  ticket_date: string;
  ticket_time: string;
  ticket_title: string;
  ticket_description: string;
  ticket_category: string;
  ticket_priority: string;
  ticket_status: string;
  customer_phone: string;
}): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif"><table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center"><tbody><tr><td>
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;max-width:480px"><tbody>
<tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:16px 16px 0 0;text-align:center">
  <div style="font-size:36px;margin-bottom:8px">🎫</div>
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">تم استلام تذكرتك</h1>
</td></tr>
<tr><td style="padding:24px;background:#ffffff">
  <p style="margin:0 0 16px;color:#1e3a5f;font-size:15px;line-height:1.6">مرحبًا ${esc(v.store_name)}،</p>
  <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.7">تم استلام تذكرتك رقم <strong>${esc(v.ticket_number)}</strong> بتاريخ ${esc(v.ticket_date)} الساعة ${esc(v.ticket_time)}.</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:16px;background:#f0f7ff;border-radius:10px"><tbody><tr><td style="padding:16px">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody>
      <tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb"><p style="margin:0">📌 <span style="color:#6b7280">العنوان:</span> ${esc(v.ticket_title)}</p></td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb"><p style="margin:0">📝 <span style="color:#6b7280">الوصف:</span></p><p style="margin:4px 0 0;color:#1e3a5f;font-size:13px">${esc(v.ticket_description)}</p></td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb"><p style="margin:0">🏷 <span style="color:#6b7280">التصنيف:</span> ${esc(v.ticket_category)}</p></td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb"><p style="margin:0">⚡ <span style="color:#6b7280">الأولوية:</span> ${esc(v.ticket_priority)}</p></td></tr>
      <tr><td style="padding:6px 0"><p style="margin:0">📊 <span style="color:#6b7280">الحالة:</span> ${esc(v.ticket_status)}</p></td></tr>
    </tbody></table>
  </td></tr></tbody></table>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#ecfdf5;border:1px solid #10b981;border-radius:10px"><tbody><tr><td style="padding:12px">
    <p style="margin:0;color:#065f46;font-size:13px">📞 تواصل مع عميلك عبر واتساب: ${esc(v.customer_phone)}</p>
  </td></tr></tbody></table>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td align="center" style="padding:8px 0;text-align:center">
    <a href="${DASHBOARD_URL}/tickets" style="color:#fff;text-decoration:none;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:8px;display:inline-block;font-size:14px;font-weight:600;padding:12px 28px" target="_blank">🔗 لوحة التحكم</a>
  </td></tr></tbody></table>
</td></tr>
${simpleFooter}
</tbody></table>
</td></tr></tbody></table></body></html>`;
}

export function lowBalanceWarningHtml(v: {
  store_name: string;
  used_percent: string;
  used_words: string;
  total_words: string;
  remaining_words: string;
  renewal_link: string;
}): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif"><table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center"><tbody><tr><td>
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;max-width:480px"><tbody>
<tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);border-radius:16px 16px 0 0;text-align:center">
  <div style="font-size:36px;margin-bottom:8px">⚡</div>
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">رصيدك على وشك النفاد</h1>
</td></tr>
<tr><td style="padding:24px;background:#ffffff">
  <p style="margin:0 0 16px;color:#1e3a5f;font-size:15px;line-height:1.6">مرحبًا ${esc(v.store_name)}،</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#fef3c7;border:1px solid #f59e0b;border-radius:10px"><tbody><tr><td align="center" style="padding:16px;text-align:center">
    <p style="margin:0 0 8px;color:#92400e;font-size:28px;font-weight:700">${esc(v.used_percent)}%</p>
    <p style="margin:0;color:#92400e;font-size:14px">من رصيد الكلمات الشهري تم استهلاكه</p>
  </td></tr></tbody></table>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#f0f7ff;border-radius:10px"><tbody><tr><td style="padding:16px">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody>
      <tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb"><p style="margin:0">📝 <span style="color:#6b7280">المستهلك:</span> ${esc(v.used_words)} كلمة</p></td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb"><p style="margin:0">📦 <span style="color:#6b7280">إجمالي الباقة:</span> ${esc(v.total_words)} كلمة</p></td></tr>
      <tr><td style="padding:6px 0"><p style="margin:0">💡 <span style="color:#6b7280">المتبقي:</span> ${esc(v.remaining_words)} كلمة</p></td></tr>
    </tbody></table>
  </td></tr></tbody></table>
  <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7">لتجنّب توقف الخدمة عند نفاد الرصيد بالكامل، ننصح بالترقية أو شحن الرصيد الآن.</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td align="center" style="padding:8px 0;text-align:center">
    <a href="${esc(v.renewal_link)}" style="color:#fff;text-decoration:none;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:8px;display:inline-block;font-size:14px;font-weight:600;padding:14px 32px" target="_blank">🔗 ترقية أو شحن الرصيد</a>
  </td></tr></tbody></table>
</td></tr>
${simpleFooter}
</tbody></table>
</td></tr></tbody></table></body></html>`;
}

export function renewalConfirmationHtml(v: {
  store_name: string;
  plan_name: string;
  new_end_date: string;
  monthly_quota: string;
}): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif"><table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center"><tbody><tr><td>
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;max-width:480px"><tbody>
<tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:16px 16px 0 0;text-align:center">
  <div style="font-size:36px;margin-bottom:8px">✅</div>
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">تم تجديد اشتراكك بنجاح</h1>
</td></tr>
<tr><td style="padding:24px;background:#ffffff">
  <p style="margin:0 0 16px;color:#1e3a5f;font-size:15px;line-height:1.6">مرحبًا ${esc(v.store_name)}،</p>
  <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7">شكرًا لتجديد اشتراكك في فقاعة AI. اشتراكك فعّال وكامل الميزات.</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#ecfdf5;border:1px solid #10b981;border-radius:10px"><tbody><tr><td style="padding:16px">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody>
      <tr><td style="padding:6px 0;border-bottom:1px solid #d1fae5"><p style="margin:0">📦 <span style="color:#065f46">الباقة:</span> <strong>${esc(v.plan_name)}</strong></p></td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #d1fae5"><p style="margin:0">📅 <span style="color:#065f46">تاريخ الانتهاء الجديد:</span> <strong>${esc(v.new_end_date)}</strong></p></td></tr>
      <tr><td style="padding:6px 0"><p style="margin:0">📝 <span style="color:#065f46">الحصة الشهرية:</span> ${esc(v.monthly_quota)} كلمة</p></td></tr>
    </tbody></table>
  </td></tr></tbody></table>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td align="center" style="padding:8px 0;text-align:center">
    <a href="https://fuqah.ai" style="color:#fff;text-decoration:none;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:8px;display:inline-block;font-size:14px;font-weight:600;padding:14px 32px" target="_blank">🔗 لوحة التحكم</a>
  </td></tr></tbody></table>
</td></tr>
${simpleFooter}
</tbody></table>
</td></tr></tbody></table></body></html>`;
}

export function servicePausedHtml(v: { store_name: string; renewal_link: string }): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif"><table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center"><tbody><tr><td>
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;max-width:480px"><tbody>
<tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);border-radius:16px 16px 0 0;text-align:center">
  <div style="font-size:36px;margin-bottom:8px">🔋</div>
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">تم إيقاف الخدمة مؤقتًا</h1>
</td></tr>
<tr><td style="padding:24px;background:#ffffff">
  <p style="margin:0 0 16px;color:#1e3a5f;font-size:15px;line-height:1.6">مرحبًا ${esc(v.store_name)}،</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#fef2f2;border:1px solid #ef4444;border-radius:10px"><tbody><tr><td align="center" style="padding:16px;text-align:center">
    <p style="margin:0;color:#991b1b;font-size:14px;font-weight:600">❌ لقد نفد رصيدك وتم إيقاف الخدمة مؤقتًا</p>
  </td></tr></tbody></table>
  <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7">اشحن الآن لتواصل تقديم خدمة العملاء الذكية لعملائك.</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td align="center" style="padding:8px 0;text-align:center">
    <a href="${esc(v.renewal_link)}" style="color:#fff;text-decoration:none;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:8px;display:inline-block;font-size:14px;font-weight:600;padding:14px 32px" target="_blank">🔗 اشحن الآن</a>
  </td></tr></tbody></table>
</td></tr>
${simpleFooter}
</tbody></table>
</td></tr></tbody></table></body></html>`;
}

export function passwordChangedHtml(v: {
  store_name: string;
  change_date: string;
  change_time: string;
}): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif"><table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center"><tbody><tr><td>
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;max-width:480px"><tbody>
<tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:16px 16px 0 0;text-align:center">
  <div style="font-size:36px;margin-bottom:8px">🔑</div>
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">تم تغيير كلمة المرور بنجاح</h1>
</td></tr>
<tr><td style="padding:24px;background:#ffffff">
  <p style="margin:0 0 16px;color:#1e3a5f;font-size:15px;line-height:1.6">مرحبًا ${esc(v.store_name)}،</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#ecfdf5;border:1px solid #10b981;border-radius:10px"><tbody><tr><td align="center" style="padding:16px;text-align:center">
    <p style="margin:0;color:#065f46;font-size:14px">✅ تم تغيير كلمة المرور بتاريخ ${esc(v.change_date)} الساعة ${esc(v.change_time)}</p>
  </td></tr></tbody></table>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:10px"><tbody><tr><td style="padding:14px">
    <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6">⚠ إذا لم تكن أنت من قام بذلك، يرجى التواصل فورًا مع فريق الدعم الفني على support@fuqah.ai.</p>
  </td></tr></tbody></table>
</td></tr>
${simpleFooter}
</tbody></table>
</td></tr></tbody></table></body></html>`;
}

export function ticketStatusUpdatedHtml(v: {
  store_name: string;
  ticket_number: string;
  new_status: string;
  ticket_title: string;
  ticket_category: string;
  ticket_priority: string;
  ticket_link: string;
}): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif"><table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center"><tbody><tr><td>
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;max-width:480px"><tbody>
<tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:16px 16px 0 0;text-align:center">
  <div style="font-size:36px;margin-bottom:8px">📩</div>
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">تم تحديث حالة تذكرتك</h1>
</td></tr>
<tr><td style="padding:24px;background:#ffffff">
  <p style="margin:0 0 16px;color:#1e3a5f;font-size:15px;line-height:1.6">مرحبًا ${esc(v.store_name)}،</p>
  <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.7">تم تحديث حالة تذكرتك رقم <strong>${esc(v.ticket_number)}</strong> إلى:</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#ecfdf5;border:1px solid #10b981;border-radius:10px"><tbody><tr><td align="center" style="padding:16px;text-align:center">
    <p style="margin:0;color:#065f46;font-size:18px;font-weight:700">${esc(v.new_status)}</p>
  </td></tr></tbody></table>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#f0f7ff;border-radius:10px"><tbody><tr><td style="padding:16px">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody>
      <tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb"><p style="margin:0">📌 <span style="color:#6b7280">العنوان:</span> ${esc(v.ticket_title)}</p></td></tr>
      <tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb"><p style="margin:0">🏷 <span style="color:#6b7280">التصنيف:</span> ${esc(v.ticket_category)}</p></td></tr>
      <tr><td style="padding:6px 0"><p style="margin:0">⚡ <span style="color:#6b7280">الأولوية:</span> ${esc(v.ticket_priority)}</p></td></tr>
    </tbody></table>
  </td></tr></tbody></table>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td align="center" style="padding:8px 0;text-align:center">
    <a href="${esc(v.ticket_link)}" style="color:#fff;text-decoration:none;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:8px;display:inline-block;font-size:14px;font-weight:600;padding:12px 28px" target="_blank">🔗 عرض التذكرة</a>
  </td></tr></tbody></table>
</td></tr>
${simpleFooter}
</tbody></table>
</td></tr></tbody></table></body></html>`;
}

export function subscriptionExpiredHtml(v: {
  store_name: string;
  expiry_date: string;
  renewal_link: string;
}): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif"><table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center"><tbody><tr><td>
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;max-width:480px"><tbody>
<tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#6b7280 0%,#4b5563 100%);border-radius:16px 16px 0 0;text-align:center">
  <div style="font-size:36px;margin-bottom:8px">😔</div>
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">انتهى اشتراكك في فقاعة AI</h1>
</td></tr>
<tr><td style="padding:24px;background:#ffffff">
  <p style="margin:0 0 16px;color:#1e3a5f;font-size:15px;line-height:1.6">مرحبًا ${esc(v.store_name)}،</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#fef2f2;border:1px solid #ef4444;border-radius:10px"><tbody><tr><td align="center" style="padding:16px;text-align:center">
    <p style="margin:0;color:#991b1b;font-size:14px">انتهى اشتراكك بتاريخ ${esc(v.expiry_date)}</p>
  </td></tr></tbody></table>
  <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7">جدد الآن قبل أن تتعثر رسائل عملائك وتفقد الخدمة السريعة.</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td align="center" style="padding:8px 0;text-align:center">
    <a href="${esc(v.renewal_link)}" style="color:#fff;text-decoration:none;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:8px;display:inline-block;font-size:14px;font-weight:600;padding:14px 32px" target="_blank">🔗 جدد اشتراكك الآن</a>
  </td></tr></tbody></table>
</td></tr>
${simpleFooter}
</tbody></table>
</td></tr></tbody></table></body></html>`;
}

export function trialEndedHtml(v: {
  store_name: string;
  subscription_link: string;
}): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif"><table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center"><tbody><tr><td>
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;max-width:480px"><tbody>
<tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:16px 16px 0 0;text-align:center">
  <div style="font-size:36px;margin-bottom:8px">🚀</div>
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">انتهت تجربتك المجانية</h1>
</td></tr>
<tr><td style="padding:24px;background:#ffffff">
  <p style="margin:0 0 16px;color:#1e3a5f;font-size:15px;line-height:1.6">مرحبًا ${esc(v.store_name)}،</p>
  <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7">انتهت تجربتك المجانية على منصة فقاعة AI. جدد اشتراكك الآن لتستمر في استخدام الذكاء الصناعي في متجرك.</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#f0f7ff;border-radius:10px"><tbody><tr><td style="padding:16px">
    <p style="margin:0 0 12px;color:#1e3a5f;font-size:14px;font-weight:600">✨ مميزات الاشتراك:</p>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody>
      <tr><td style="padding:4px 0;color:#374151;font-size:13px">✓ ردود ذكية غير محدودة</td></tr>
      <tr><td style="padding:4px 0;color:#374151;font-size:13px">✓ تدريب مخصص للبوت</td></tr>
      <tr><td style="padding:4px 0;color:#374151;font-size:13px">✓ دعم فني متميز</td></tr>
    </tbody></table>
  </td></tr></tbody></table>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td align="center" style="padding:8px 0;text-align:center">
    <a href="${esc(v.subscription_link)}" style="color:#fff;text-decoration:none;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:8px;display:inline-block;font-size:14px;font-weight:600;padding:14px 32px" target="_blank">🔗 ابدأ اشتراكك الآن</a>
  </td></tr></tbody></table>
  <p style="margin:20px 0 0;color:#6b7280;font-size:13px;line-height:1.6;text-align:center">إذا واجهت أي صعوبة، تواصل معنا. نحن هنا دائمًا لخدمتك ❤</p>
</td></tr>
${simpleFooter}
</tbody></table>
</td></tr></tbody></table></body></html>`;
}

export function subscriptionExpiryWarningHtml(v: {
  store_name: string;
  days_remaining: string;
  package_name: string;
  renewal_link: string;
}): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif"><table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center"><tbody><tr><td>
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;max-width:480px"><tbody>
<tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);border-radius:16px 16px 0 0;text-align:center">
  <div style="font-size:36px;margin-bottom:8px">⏰</div>
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">باقتك ستنتهي قريبًا!</h1>
</td></tr>
<tr><td style="padding:24px;background:#ffffff">
  <p style="margin:0 0 16px;color:#1e3a5f;font-size:15px;line-height:1.6">مرحبًا ${esc(v.store_name)}،</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#fef3c7;border:1px solid #f59e0b;border-radius:10px"><tbody><tr><td align="center" style="padding:16px;text-align:center">
    <p style="margin:0 0 8px;color:#92400e;font-size:24px;font-weight:700">${esc(v.days_remaining)} يوم</p>
    <p style="margin:0;color:#92400e;font-size:14px">متبقية على انتهاء باقة ${esc(v.package_name)}</p>
  </td></tr></tbody></table>
  <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7">جدد الآن لتجنب توقف الخدمة أو قم بالترقية لزيادة رصيد الرسائل.</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td align="center" style="padding:8px 0;text-align:center">
    <a href="${esc(v.renewal_link)}" style="color:#fff;text-decoration:none;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:8px;display:inline-block;font-size:14px;font-weight:600;padding:14px 32px" target="_blank">🔗 تجديد الآن</a>
  </td></tr></tbody></table>
</td></tr>
${simpleFooter}
</tbody></table>
</td></tr></tbody></table></body></html>`;
}

export function storeDisconnectedHtml(v: {
  store_name: string;
  platform_name: string;
  disconnect_date: string;
}): string {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif"><table border="0" width="100%" cellpadding="0" cellspacing="0" role="presentation" align="center"><tbody><tr><td>
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;max-width:480px"><tbody>
<tr><td align="center" style="padding:24px;background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);border-radius:16px 16px 0 0;text-align:center">
  <div style="font-size:36px;margin-bottom:8px">⚠</div>
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">تم إلغاء ربط متجرك</h1>
</td></tr>
<tr><td style="padding:24px;background:#ffffff">
  <p style="margin:0 0 16px;color:#1e3a5f;font-size:15px;line-height:1.6">مرحبًا ${esc(v.store_name)}،</p>
  <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7">تم إلغاء ربط متجرك مع منصة <strong>${esc(v.platform_name)}</strong> بتاريخ ${esc(v.disconnect_date)}</p>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;background:#fef2f2;border:1px solid #ef4444;border-radius:10px"><tbody><tr><td style="padding:16px">
    <p style="margin:0;color:#991b1b;font-size:13px;line-height:1.6">❌ <strong>تنبيه:</strong> لن يتم استقبال أو إرسال أي ردود تلقائية حتى تتم إعادة الربط.</p>
  </td></tr></tbody></table>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tbody><tr><td align="center" style="padding:8px 0;text-align:center">
    <a href="${DASHBOARD_URL}/integrations" style="color:#fff;text-decoration:none;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:8px;display:inline-block;font-size:14px;font-weight:600;padding:14px 32px" target="_blank">🔗 إعادة الربط الآن</a>
  </td></tr></tbody></table>
</td></tr>
${simpleFooter}
</tbody></table>
</td></tr></tbody></table></body></html>`;
}