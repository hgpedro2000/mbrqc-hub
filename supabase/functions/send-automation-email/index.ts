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
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? FALLBACK)
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
}

function buildReportData(rows: NgRow[]): ReportData {
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
    dateBR: fmtDate(new Date()),
    dateLong: fmtDateLong(new Date()),
  }
}

function buildDashboardHtml(data: ReportData, message: string, pdfUrl: string | null) {
  const { rows, totalNg, totalInsp, ppm, byType, topFailures, dateLong, dateBR } = data
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
        <div style="font-size:14px;font-weight:600;">Relatório NG ${escapeHtml(dateBR)} (PDF)</div>
      </div>
      <a href="${pdfUrl}" style="background:#fff;color:#354052;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">Baixar PDF</a>
    </div>` : ''

  return `<!doctype html><html><head><meta charset="utf-8"><title>Relatório NG ${dateBR}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;">
  <div style="max-width:760px;margin:0 auto;padding:24px;">
    <div style="background:#354052;color:#fff;border-radius:12px;padding:24px;">
      <div style="font-size:12px;opacity:.7;text-transform:uppercase;letter-spacing:.1em;">MBR Quality • Dashboard NG</div>
      <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;">Relatório de Peças NG</h1>
      <div style="font-size:13px;opacity:.85;">${escapeHtml(dateLong)}</div>
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
  const { rows, totalNg, totalInsp, ppm, byType, topFailures, dateBR, dateLong } = data
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // Header band
  doc.setFillColor(53, 64, 82)
  doc.rect(0, 0, pageW, 80, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.text('MBR QUALITY • DASHBOARD NG', 32, 30)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Relatório de Peças NG', 32, 52)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(dateLong, 32, 68)

  // Stats cards
  doc.setTextColor(15, 23, 42)
  let y = 100
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

  // NG por tipo
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(10)
  doc.text('NG POR TIPO', 32, y)
  y += 6
  autoTable(doc, {
    startY: y,
    margin: { left: 32, right: 32 },
    head: [['Tipo', 'Quantidade']],
    body: byType.length ? byType.map(([k, v]) => [TIPO_LABEL[k] ?? k, String(v)]) : [['—', '0']],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139] },
  })
  y = (doc as any).lastAutoTable.finalY + 16

  // Top 5 falhas
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(10)
  doc.text('TOP 5 MODOS DE FALHA', 32, y)
  y += 6
  autoTable(doc, {
    startY: y,
    margin: { left: 32, right: 32 },
    head: [['Modo de Falha', 'Qtd NG']],
    body: topFailures.length ? topFailures.map(([n, q]) => [n, String(q)]) : [['—', '0']],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139] },
    columnStyles: { 1: { halign: 'right', textColor: [220, 38, 38], fontStyle: 'bold' } },
  })
  y = (doc as any).lastAutoTable.finalY + 16

  // Detalhado
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(10)
  doc.text('RELATÓRIO DETALHADO', 32, y)
  y += 6
  autoTable(doc, {
    startY: y,
    margin: { left: 32, right: 32 },
    head: [['Nº', 'Tipo', 'Part Number', 'Fornecedor', 'Modo Falha', 'Qtd NG', 'Responsável']],
    body: rows.length
      ? rows.map(r => [
          safe(r.numero),
          safe(TIPO_LABEL[r.tipo ?? ''] ?? r.tipo),
          safe(r.part_number),
          safe(r.fornecedor),
          safe(r.modo_falha),
          String(r.quantidade_ng ?? 0),
          safe(r.responsavel),
        ])
      : [['—', '—', '—', '—', 'Sem registros NG no período', '0', '—']],
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [53, 64, 82], textColor: 255 },
    columnStyles: { 5: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] } },
    didDrawPage: () => {
      const pgH = doc.internal.pageSize.getHeight()
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text(`MBR Quality • ${dateBR}`, 32, pgH - 16)
      doc.text(`Página ${doc.getNumberOfPages()}`, pageW - 64, pgH - 16)
    },
  })

  return new Uint8Array(doc.output('arraybuffer'))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const body = await req.json().catch(() => ({}))
    const { config_id, log_id, test_to, preview } = body as {
      config_id?: string
      log_id?: string
      test_to?: string
      preview?: boolean
    }
    if (!config_id) {
      return new Response(JSON.stringify({ error: 'config_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: config, error: cfgErr } = await supabase
      .from('email_automation_config').select('*').eq('id', config_id).single()
    if (cfgErr || !config) throw new Error('Configuração não encontrada')

    const now = new Date()
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const y = tzDate.getFullYear()
    const m = String(tzDate.getMonth() + 1).padStart(2, '0')
    const d = String(tzDate.getDate()).padStart(2, '0')
    const dayStr = `${y}-${m}-${d}`
    const dateBR = fmtDate(now)

    // Idempotency (skip for preview / test)
    const isReal = !preview && !test_to
    if (isReal) {
      const { data: existing } = await supabase
        .from('email_automation_log')
        .select('id, status, pdf_url, subject')
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

    // Fetch today's NG rows
    const { data: rowsData } = await supabase
      .from('apontamentos')
      .select('numero, tipo, part_number, part_name, fornecedor, modo_falha, quantidade_ng, quantidade_inspecionada, responsavel, turno, created_at')
      .gte('data', dayStr).lte('data', dayStr)
      .gt('quantidade_ng', 0)
      .order('created_at', { ascending: false })
    const rows: NgRow[] = (rowsData ?? []) as NgRow[]
    const data = buildReportData(rows)

    // Vars + subject + message
    const vars: Record<string, string> = {
      date: dateBR, day: d, month: m, year: String(y),
      total_ng: String(data.totalNg), total_records: String(rows.length),
      total_inspected: String(data.totalInsp), ppm: String(data.ppm),
    }
    const subject = replaceVars(config.subject_template || 'Relatório NG — {{date}}', vars)
    const messageBody = replaceVars(config.message_body || '', vars)

    // Generate PDF + upload + signed URL
    let pdfUrl: string | null = null
    let pdfPath: string | null = null
    if (config.include_ng_pdf !== false) {
      try {
        const pdfBytes = buildPdf(data)
        pdfPath = `${config.id}/${dayStr}${test_to || preview ? `-preview-${Date.now()}` : ''}.pdf`
        const { error: upErr } = await supabase.storage
          .from('email-reports')
          .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true })
        if (upErr) throw upErr
        // 30-day signed URL
        const { data: signed, error: signErr } = await supabase.storage
          .from('email-reports')
          .createSignedUrl(pdfPath, 60 * 60 * 24 * 30)
        if (signErr) throw signErr
        pdfUrl = signed?.signedUrl ?? null
      } catch (pdfErr) {
        console.error('PDF generation/upload failed', pdfErr)
      }
    }

    const html = buildDashboardHtml(data, messageBody, pdfUrl)

    // PREVIEW MODE — return without sending or logging
    if (preview) {
      return new Response(JSON.stringify({
        ok: true, preview: true, subject, html, pdf_url: pdfUrl,
        ng_records: rows.length, total_ng: data.totalNg,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const recipients: string[] = test_to ? [test_to] : (config.recipients ?? [])
    if (recipients.length === 0) throw new Error('Sem destinatários configurados')

    const senderDomain = Deno.env.get('SENDER_DOMAIN') ?? 'notify.mbrqc.com.br'
    const fromAddr = 'informacao@mbrqc.com.br'

    const messageIds: string[] = []
    for (const to of recipients) {
      const messageId = crypto.randomUUID()
      const payload = {
        to, from: fromAddr, sender_domain: senderDomain,
        subject, html,
        purpose: 'transactional' as const,
        label: 'ng-daily-report',
        idempotency_key: `${config.id}-${dayStr}-${to}${test_to ? '-test-' + Date.now() : ''}`,
        message_id: messageId,
        queued_at: new Date().toISOString(),
      }
      const { error: enqErr } = await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails', payload,
      })
      if (enqErr) throw enqErr
      messageIds.push(messageId)
    }

    // Log (idempotent)
    if (log_id) {
      await supabase.from('email_automation_log').update({
        status: 'queued', ng_count: rows.length,
        recipients, subject, pdf_url: pdfUrl, send_date: dayStr,
      }).eq('id', log_id)
    } else if (test_to) {
      await supabase.from('email_automation_log').insert({
        config_id: config.id, trigger_type: 'test',
        recipients, subject, status: 'queued',
        ng_count: rows.length, pdf_url: pdfUrl,
        send_date: dayStr,
      })
    } else {
      // Manual: upsert by (config_id, send_date)
      const { error: insErr } = await supabase.from('email_automation_log').insert({
        config_id: config.id, trigger_type: 'manual',
        recipients, subject, status: 'queued',
        ng_count: rows.length, pdf_url: pdfUrl,
        send_date: dayStr,
      })
      if (insErr && !String(insErr.message).includes('duplicate')) throw insErr
    }

    if (!test_to) {
      await supabase.from('email_automation_config')
        .update({ last_sent_at: new Date().toISOString() }).eq('id', config.id)
    }

    return new Response(JSON.stringify({
      ok: true, queued: messageIds.length, ng_records: rows.length,
      total_ng: data.totalNg, pdf_url: pdfUrl,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('send-automation-email error', msg)
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
