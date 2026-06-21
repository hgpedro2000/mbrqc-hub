import { createClient } from 'npm:@supabase/supabase-js@2'
import { jsPDF } from 'npm:jspdf@2.5.1'
import autoTable from 'npm:jspdf-autotable@3.8.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FALLBACK = '—'

function fmtDate(d: Date) {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}
function fmtDateLong(d: Date) {
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}
function escapeHtml(v: unknown): string {
  if (v === null || v === undefined || v === '') return FALLBACK
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function safe(v: unknown): string {
  if (v === null || v === undefined || v === '') return FALLBACK
  return String(v)
}
function replaceVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const val = vars[k]
    if (val === undefined || val === null || val === '') return FALLBACK
    return val
  })
}

interface NgRow {
  numero: string | null
  tipo: string | null
  part_number: string | null
  part_name: string | null
  fornecedor: string | null
  modo_falha: string | null
  quantidade_ng: number | null
  quantidade_inspecionada: number | null
  responsavel: string | null
  turno: string | null
  created_at: string
}

const TIPO_LABEL: Record<string, string> = {
  incoming: 'Incoming', peca: 'Peça', processo: 'Processo', oem: 'OEM',
}

interface ReportData {
  rows: NgRow[]
  totalNg: number
  totalInsp: number
  ppm: number
  byType: Array<[string, number]>
  topFailures: Array<[string, number]>
  dateBR: string
  dateLong: string
  periodLabel: string
}

function buildReportData(rows: NgRow[], periodLabel: string, dateBR: string, dateLong: string): ReportData {
  const totalNg = rows.reduce((s, r) => s + (r.quantidade_ng ?? 0), 0)
  const totalInsp = rows.reduce((s, r) => s + (r.quantidade_inspecionada ?? 0), 0)
  const ppm = totalInsp > 0 ? Math.round((totalNg / totalInsp) * 1_000_000) : 0
  const byTypeMap = new Map<string, number>()
  for (const r of rows) {
    const k = r.tipo || 'outros'
    byTypeMap.set(k, (byTypeMap.get(k) ?? 0) + (r.quantidade_ng ?? 0))
  }
  const byFailureMap = new Map<string, number>()
  for (const r of rows) {
    if (!r.modo_falha) continue
    byFailureMap.set(r.modo_falha, (byFailureMap.get(r.modo_falha) ?? 0) + (r.quantidade_ng ?? 0))
  }
  return {
    rows, totalNg, totalInsp, ppm,
    byType: [...byTypeMap.entries()],
    topFailures: [...byFailureMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    dateBR, dateLong, periodLabel,
  }
}

function buildDashboardHtml(data: ReportData, message: string, pdfUrl: string | null) {
  const { rows, totalNg, totalInsp, ppm, byType, topFailures, dateLong, dateBR, periodLabel } = data
  const rowsHtml = rows.length === 0
    ? `<tr><td colspan="7" style="padding:24px;text-align:center;color:#64748b;font-style:italic;">Sem registros NG no período.</td></tr>`
    : rows.slice(0, 50).map(r => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;">${escapeHtml(r.numero)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(TIPO_LABEL[r.tipo ?? ''] ?? r.tipo)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.part_number)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.fornecedor)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.modo_falha)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#dc2626;">${r.quantidade_ng ?? 0}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.responsavel)}</td>
      </tr>`).join('')

  const failuresHtml = topFailures.length === 0
    ? `<p style="color:#64748b;font-style:italic;margin:0;">Nenhum modo de falha registrado.</p>`
    : `<table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${topFailures.map(([n, q]) => `<tr><td style="padding:6px 0;">${escapeHtml(n)}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#dc2626;">${q}</td></tr>`).join('')}
      </table>`

  const typesHtml = byType.map(([k, v]) => `
    <div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">${escapeHtml(TIPO_LABEL[k] ?? k)}</div>
      <div style="font-size:22px;font-weight:700;color:#0f172a;margin-top:4px;">${v}</div>
    </div>`).join('') || '<div style="color:#64748b;font-style:italic;">Sem tipos.</div>'

  const pdfBanner = pdfUrl ? `
    <div style="background:#354052;color:#fff;border-radius:12px;padding:16px;margin-top:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.1em;">Anexo</div>
        <div style="font-size:14px;font-weight:600;">Relatório NG ${escapeHtml(periodLabel)} (PDF)</div>
      </div>
      <a href="${pdfUrl}" style="background:#fff;color:#354052;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">Baixar PDF</a>
    </div>` : ''

  return `<!doctype html><html><head><meta charset="utf-8"><title>Relatório NG ${escapeHtml(periodLabel)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;">
  <div style="max-width:760px;margin:0 auto;padding:24px;">
    <div style="background:#354052;color:#fff;border-radius:12px;padding:24px;">
      <div style="font-size:12px;opacity:.7;text-transform:uppercase;letter-spacing:.1em;">MBR Quality • Dashboard NG</div>
      <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;">Relatório de Peças NG</h1>
      <div style="font-size:13px;opacity:.85;">${escapeHtml(dateLong)}</div>
      <div style="font-size:12px;opacity:.7;margin-top:4px;">Período: ${escapeHtml(periodLabel)}</div>
    </div>
    ${message ? `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>` : ''}
    ${pdfBanner}
    <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:140px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Total NG</div>
        <div style="font-size:28px;font-weight:700;color:#dc2626;margin-top:4px;">${totalNg}</div>
      </div>
      <div style="flex:1;min-width:140px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Inspecionadas</div>
        <div style="font-size:28px;font-weight:700;color:#0f172a;margin-top:4px;">${totalInsp}</div>
      </div>
      <div style="flex:1;min-width:140px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">PPM</div>
        <div style="font-size:28px;font-weight:700;color:#354052;margin-top:4px;">${ppm.toLocaleString('pt-BR')}</div>
      </div>
      <div style="flex:1;min-width:140px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Registros</div>
        <div style="font-size:28px;font-weight:700;color:#0f172a;margin-top:4px;">${rows.length}</div>
      </div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;">
      <h2 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">NG por Tipo</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">${typesHtml}</div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;">
      <h2 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Top 5 Modos de Falha</h2>
      ${failuresHtml}
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;overflow:auto;">
      <h2 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Relatório Detalhado de Peças NG</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f8fafc;text-align:left;">
          <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Nº</th>
          <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Tipo</th>
          <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Part Number</th>
          <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Fornecedor</th>
          <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Modo Falha</th>
          <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;text-align:right;">Qtd NG</th>
          <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Responsável</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${rows.length > 50 ? `<p style="color:#64748b;font-size:12px;margin:8px 0 0;">Mostrando 50 de ${rows.length} registros. PDF anexo contém todos.</p>` : ''}
    </div>
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin:24px 0 0;">MBR Quality — Envio automatizado • ${escapeHtml(dateBR)}</p>
  </div>
</body></html>`
}

function buildPdf(data: ReportData): Uint8Array {
  const { rows, totalNg, totalInsp, ppm, byType, topFailures, dateBR, dateLong, periodLabel } = data
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFillColor(53, 64, 82)
  doc.rect(0, 0, pageW, 90, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.text('MBR QUALITY • DASHBOARD NG', 32, 28)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Relatório de Peças NG', 32, 50)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(dateLong, 32, 66)
  doc.setFontSize(9)
  doc.text(`Período: ${periodLabel}`, 32, 80)

  doc.setTextColor(15, 23, 42)
  let y = 110
  const cardW = (pageW - 64 - 24) / 4
  const stats = [
    ['Total NG', String(totalNg), [220, 38, 38]],
    ['Inspecionadas', String(totalInsp), [15, 23, 42]],
    ['PPM', ppm.toLocaleString('pt-BR'), [53, 64, 82]],
    ['Registros', String(rows.length), [15, 23, 42]],
  ] as const
  stats.forEach(([label, value, color], i) => {
    const x = 32 + i * (cardW + 8)
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(x, y, cardW, 56, 6, 6, 'FD')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(String(label).toUpperCase(), x + 10, y + 16)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(color[0], color[1], color[2])
    doc.text(value, x + 10, y + 42)
    doc.setFont('helvetica', 'normal')
  })
  y += 72

  doc.setTextColor(100, 116, 139)
  doc.setFontSize(10)
  doc.text('NG POR TIPO', 32, y); y += 6
  autoTable(doc, {
    startY: y, margin: { left: 32, right: 32 },
    head: [['Tipo', 'Quantidade']],
    body: byType.length ? byType.map(([k, v]) => [TIPO_LABEL[k] ?? k, String(v)]) : [['—', '0']],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139] },
  })
  y = (doc as any).lastAutoTable.finalY + 16

  doc.setTextColor(100, 116, 139); doc.setFontSize(10)
  doc.text('TOP 5 MODOS DE FALHA', 32, y); y += 6
  autoTable(doc, {
    startY: y, margin: { left: 32, right: 32 },
    head: [['Modo de Falha', 'Qtd NG']],
    body: topFailures.length ? topFailures.map(([n, q]) => [n, String(q)]) : [['—', '0']],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139] },
    columnStyles: { 1: { halign: 'right', textColor: [220, 38, 38], fontStyle: 'bold' } },
  })
  y = (doc as any).lastAutoTable.finalY + 16

  doc.setTextColor(100, 116, 139); doc.setFontSize(10)
  doc.text('RELATÓRIO DETALHADO', 32, y); y += 6
  autoTable(doc, {
    startY: y, margin: { left: 32, right: 32 },
    head: [['Nº', 'Tipo', 'Part Number', 'Fornecedor', 'Modo Falha', 'Qtd NG', 'Responsável']],
    body: rows.length
      ? rows.map(r => [
          safe(r.numero), safe(TIPO_LABEL[r.tipo ?? ''] ?? r.tipo),
          safe(r.part_number), safe(r.fornecedor), safe(r.modo_falha),
          String(r.quantidade_ng ?? 0), safe(r.responsavel),
        ])
      : [['—', '—', '—', '—', 'Sem registros NG no período', '0', '—']],
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [53, 64, 82], textColor: 255 },
    columnStyles: { 5: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] } },
    didDrawPage: () => {
      const pgH = doc.internal.pageSize.getHeight()
      doc.setFontSize(8); doc.setTextColor(148, 163, 184)
      doc.text(`MBR Quality • ${dateBR} • ${periodLabel}`, 32, pgH - 16)
      doc.text(`Página ${doc.getNumberOfPages()}`, pageW - 64, pgH - 16)
    },
  })

  return new Uint8Array(doc.output('arraybuffer'))
}

async function notifyError(supabase: any, config: any, configId: string, reason: string, dayStr: string, logId: string | null) {
  try {
    const adminList: string[] = (config?.error_notify_recipients?.length ? config.error_notify_recipients : config?.recipients) ?? []
    if (adminList.length === 0) return
    const subject = `[MBR Quality] FALHA no envio do relatório NG — ${config?.name ?? configId}`
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #fecaca;border-radius:12px;padding:24px;">
        <div style="background:#dc2626;color:#fff;padding:12px;border-radius:8px;margin-bottom:16px;font-weight:600;">
          ⚠️ Falha na automação de e-mails
        </div>
        <p><strong>Automação:</strong> ${escapeHtml(config?.name ?? '—')}</p>
        <p><strong>Config ID:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${escapeHtml(configId)}</code></p>
        <p><strong>Data:</strong> ${escapeHtml(dayStr)}</p>
        ${logId ? `<p><strong>Log ID:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${escapeHtml(logId)}</code></p>` : ''}
        <p><strong>Motivo:</strong></p>
        <pre style="background:#fef2f2;color:#7f1d1d;padding:12px;border-radius:8px;white-space:pre-wrap;font-size:12px;border:1px solid #fecaca;">${escapeHtml(reason)}</pre>
        <p style="color:#64748b;font-size:12px;margin-top:16px;">Você pode reenviar manualmente na aba <strong>E-mails</strong> em Engenharia.</p>
      </div>
    </body></html>`
    const senderDomain = Deno.env.get('SENDER_DOMAIN') ?? 'notify.mbrqc.com.br'
    for (const to of adminList) {
      await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to, from: 'informacao@mbrqc.com.br', sender_domain: senderDomain,
          subject, html, purpose: 'transactional',
          label: 'ng-automation-error',
          idempotency_key: `err-${configId}-${dayStr}-${logId ?? 'noLog'}-${to}`,
          message_id: crypto.randomUUID(),
          queued_at: new Date().toISOString(),
        },
      })
    }
    if (logId) {
      await supabase.from('email_automation_log')
        .update({ error_notified: true }).eq('id', logId)
    }
  } catch (e) {
    console.error('notifyError failed', e)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  let body: any = {}
  let configCached: any = null
  let dayStrCached = ''
  let logIdInProgress: string | null = null

  try {
    body = await req.json().catch(() => ({}))
    const {
      config_id, log_id, test_to, preview, draft, resend,
      period_start, period_end,
    } = body as {
      config_id?: string; log_id?: string; test_to?: string;
      preview?: boolean; draft?: boolean; resend?: boolean;
      period_start?: string; period_end?: string;
    }
    if (!config_id) {
      return new Response(JSON.stringify({ error: 'config_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    logIdInProgress = log_id ?? null

    const { data: config, error: cfgErr } = await supabase
      .from('email_automation_config').select('*').eq('id', config_id).single()
    if (cfgErr || !config) throw new Error('Configuração não encontrada')
    configCached = config

    // Determine period
    const now = new Date()
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const y = tzDate.getFullYear()
    const m = String(tzDate.getMonth() + 1).padStart(2, '0')
    const d = String(tzDate.getDate()).padStart(2, '0')
    const todayStr = `${y}-${m}-${d}`
    const pStart = period_start || todayStr
    const pEnd = period_end || (period_start ? period_start : todayStr)
    const dayStr = todayStr
    dayStrCached = dayStr
    const dateBR = fmtDate(now)
    const dateLong = fmtDateLong(now)
    const periodLabel = pStart === pEnd
      ? new Date(pStart + 'T12:00:00').toLocaleDateString('pt-BR')
      : `${new Date(pStart + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(pEnd + 'T12:00:00').toLocaleDateString('pt-BR')}`

    // Idempotency — skip for preview/test/draft/resend
    const isReal = !preview && !test_to && !draft && !resend
    if (isReal) {
      const { data: existing } = await supabase
        .from('email_automation_log')
        .select('id, status')
        .eq('config_id', config.id)
        .eq('send_date', dayStr)
        .in('trigger_type', ['scheduled', 'manual'])
        .in('status', ['queued', 'sent', 'pending'])
        .maybeSingle()
      if (existing && (!log_id || existing.id !== log_id)) {
        return new Response(JSON.stringify({
          ok: true, skipped: 'already_sent_today', existing_log_id: existing.id,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Fetch NG rows for period
    const { data: rowsData } = await supabase
      .from('apontamentos')
      .select('numero, tipo, part_number, part_name, fornecedor, modo_falha, quantidade_ng, quantidade_inspecionada, responsavel, turno, created_at')
      .gte('data', pStart).lte('data', pEnd)
      .gt('quantidade_ng', 0)
      .order('created_at', { ascending: false })
    const rows: NgRow[] = (rowsData ?? []) as NgRow[]
    const data = buildReportData(rows, periodLabel, dateBR, dateLong)

    // Vars + subject + message (with fallback)
    const vars: Record<string, string> = {
      date: dateBR, period: periodLabel,
      day: d, month: m, year: String(y),
      total_ng: String(data.totalNg), total_records: String(rows.length),
      total_inspected: String(data.totalInsp), ppm: String(data.ppm),
    }
    const subject = replaceVars(config.subject_template || 'Relatório NG — {{date}}', vars)
    const messageBody = replaceVars(config.message_body || '', vars)

    // Generate PDF (catch errors and notify)
    let pdfUrl: string | null = null
    let pdfPath: string | null = null
    let pdfError: string | null = null
    if (config.include_ng_pdf !== false) {
      try {
        const pdfBytes = buildPdf(data)
        const suffix = draft ? `-draft-${Date.now()}` : (test_to ? `-test-${Date.now()}` : (preview ? `-preview-${Date.now()}` : (resend ? `-r${Date.now()}` : '')))
        pdfPath = `${config.id}/${dayStr}${suffix}.pdf`
        const { error: upErr } = await supabase.storage
          .from('email-reports')
          .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true })
        if (upErr) throw upErr
        const { data: signed, error: signErr } = await supabase.storage
          .from('email-reports')
          .createSignedUrl(pdfPath, 60 * 60 * 24 * 30)
        if (signErr) throw signErr
        pdfUrl = signed?.signedUrl ?? null
      } catch (pdfErr) {
        pdfError = pdfErr instanceof Error ? pdfErr.message : String(pdfErr)
        console.error('PDF generation/upload failed', pdfError)
        // For real sends, notify admins about the PDF failure but continue without PDF
        if (isReal || resend) {
          await notifyError(supabase, config, config.id, `Falha ao gerar/anexar PDF: ${pdfError}`, dayStr, log_id ?? null)
        }
      }
    }

    const html = buildDashboardHtml(data, messageBody, pdfUrl)

    // PREVIEW MODE — never logs nor sends
    if (preview) {
      return new Response(JSON.stringify({
        ok: true, preview: true, subject, html, pdf_url: pdfUrl,
        ng_records: rows.length, total_ng: data.totalNg,
        period_start: pStart, period_end: pEnd, pdf_error: pdfError,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // DRAFT MODE — saves HTML+PDF in log, no send
    if (draft) {
      const { data: existingDraft } = await supabase
        .from('email_automation_log')
        .select('id').eq('config_id', config.id)
        .eq('send_date', dayStr).eq('trigger_type', 'draft')
        .maybeSingle()
      let draftId = existingDraft?.id
      if (draftId) {
        await supabase.from('email_automation_log').update({
          preview_html: html, preview_pdf_url: pdfUrl,
          ng_count: rows.length, subject,
          period_start: pStart, period_end: pEnd,
          status: 'draft', error_message: pdfError,
        }).eq('id', draftId)
      } else {
        const { data: ins } = await supabase.from('email_automation_log').insert({
          config_id: config.id, trigger_type: 'draft', recipients: config.recipients ?? [],
          subject, status: 'draft', ng_count: rows.length,
          pdf_url: pdfUrl, preview_html: html, preview_pdf_url: pdfUrl,
          period_start: pStart, period_end: pEnd, send_date: dayStr,
          error_message: pdfError,
        }).select('id').single()
        draftId = ins?.id
      }
      return new Response(JSON.stringify({
        ok: true, draft: true, draft_id: draftId,
        subject, html, pdf_url: pdfUrl,
        ng_records: rows.length, total_ng: data.totalNg, pdf_error: pdfError,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Resolve recipients
    const recipients: string[] = test_to
      ? [test_to]
      : Array.from(new Set((config.recipients ?? []).filter(Boolean)))
    if (recipients.length === 0) throw new Error('Sem destinatários configurados')

    const senderDomain = Deno.env.get('SENDER_DOMAIN') ?? 'notify.mbrqc.com.br'
    const fromAddr = 'informacao@mbrqc.com.br'

    const messageIds: string[] = []
    const triggerSuffix = resend ? `-r${Date.now()}` : (test_to ? `-test-${Date.now()}` : '')
    for (const to of recipients) {
      const messageId = crypto.randomUUID()
      const { error: enqErr } = await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to, from: fromAddr, sender_domain: senderDomain,
          subject, html, purpose: 'transactional' as const,
          label: 'ng-daily-report',
          idempotency_key: `${config.id}-${dayStr}-${to}${triggerSuffix}`,
          message_id: messageId, queued_at: new Date().toISOString(),
        },
      })
      if (enqErr) throw enqErr
      messageIds.push(messageId)
    }

    // Compute attempt number for resends
    let attempt = 1
    if (resend) {
      const { count } = await supabase.from('email_automation_log')
        .select('id', { count: 'exact', head: true })
        .eq('config_id', config.id).eq('send_date', dayStr)
      attempt = (count ?? 0) + 1
    }

    // Logging
    if (log_id) {
      await supabase.from('email_automation_log').update({
        status: 'queued', ng_count: rows.length,
        recipients, subject, pdf_url: pdfUrl, send_date: dayStr,
        period_start: pStart, period_end: pEnd,
      }).eq('id', log_id)
    } else if (test_to) {
      await supabase.from('email_automation_log').insert({
        config_id: config.id, trigger_type: 'test',
        recipients, subject, status: 'queued',
        ng_count: rows.length, pdf_url: pdfUrl,
        send_date: dayStr, period_start: pStart, period_end: pEnd,
      })
    } else {
      const triggerType = resend ? 'manual' : 'manual'
      const { error: insErr } = await supabase.from('email_automation_log').insert({
        config_id: config.id, trigger_type: triggerType,
        recipients, subject, status: 'queued',
        ng_count: rows.length, pdf_url: pdfUrl,
        send_date: dayStr, period_start: pStart, period_end: pEnd,
        attempt,
      })
      if (insErr) {
        // Idempotency conflict on resend? Only happens if there's already a queued/sent row
        if (String(insErr.message).toLowerCase().includes('duplicate') && !resend) {
          // existing row — ok
        } else if (resend) {
          // resend conflict (another row already queued/sent) — that's fine, the enqueue still happened
          console.log('resend already had queued row, enqueued anyway')
        } else {
          throw insErr
        }
      }
    }

    if (!test_to && !resend) {
      await supabase.from('email_automation_config')
        .update({ last_sent_at: new Date().toISOString() }).eq('id', config.id)
    }

    return new Response(JSON.stringify({
      ok: true, queued: messageIds.length, ng_records: rows.length,
      total_ng: data.totalNg, pdf_url: pdfUrl, attempt,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('send-automation-email error', msg)

    // Record failure in log + notify admins
    try {
      if (logIdInProgress) {
        await supabase.from('email_automation_log').update({
          status: 'failed', error_message: msg.slice(0, 1000),
        }).eq('id', logIdInProgress)
      } else if (body?.config_id && !body?.preview && !body?.draft) {
        await supabase.from('email_automation_log').insert({
          config_id: body.config_id,
          trigger_type: body?.test_to ? 'test' : (body?.resend ? 'manual' : 'manual'),
          recipients: body?.test_to ? [body.test_to] : [],
          status: 'failed', error_message: msg.slice(0, 1000),
          send_date: dayStrCached || null,
        })
      }
      if (configCached && body?.config_id && !body?.preview && !body?.draft) {
        await notifyError(supabase, configCached, body.config_id, msg, dayStrCached, logIdInProgress)
      }
    } catch (logErr) {
      console.error('failed to log error', logErr)
    }

    return new Response(JSON.stringify({ error: msg, config_id: body?.config_id ?? null }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
