import { createClient } from 'npm:@supabase/supabase-js@2'

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
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function escapeHtml(v: unknown): string {
  if (v === null || v === undefined || v === '') return FALLBACK
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

function buildDashboardHtml(rows: NgRow[], dateStr: string, message: string) {
  const totalNg = rows.reduce((s, r) => s + (r.quantidade_ng ?? 0), 0)
  const totalInsp = rows.reduce((s, r) => s + (r.quantidade_inspecionada ?? 0), 0)
  const ppm = totalInsp > 0 ? Math.round((totalNg / totalInsp) * 1_000_000) : 0

  const byType = new Map<string, number>()
  for (const r of rows) {
    const k = r.tipo || 'outros'
    byType.set(k, (byType.get(k) ?? 0) + (r.quantidade_ng ?? 0))
  }
  const byFailure = new Map<string, number>()
  for (const r of rows) {
    if (!r.modo_falha) continue
    byFailure.set(r.modo_falha, (byFailure.get(r.modo_falha) ?? 0) + (r.quantidade_ng ?? 0))
  }
  const topFailures = [...byFailure.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const tipoLabel: Record<string, string> = {
    incoming: 'Incoming',
    peca: 'Peça',
    processo: 'Processo',
    oem: 'OEM',
  }

  const rowsHtml = rows.length === 0
    ? `<tr><td colspan="7" style="padding:24px;text-align:center;color:#64748b;font-style:italic;">Sem registros NG no período.</td></tr>`
    : rows.slice(0, 50).map(r => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;">${escapeHtml(r.numero)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(tipoLabel[r.tipo ?? ''] ?? r.tipo)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.part_number)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.fornecedor)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.modo_falha)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#dc2626;">${r.quantidade_ng ?? 0}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(r.responsavel)}</td>
      </tr>`).join('')

  const failuresHtml = topFailures.length === 0
    ? `<p style="color:#64748b;font-style:italic;margin:0;">Nenhum modo de falha registrado.</p>`
    : `<table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${topFailures.map(([name, qty]) => `
          <tr>
            <td style="padding:6px 0;color:#0f172a;">${escapeHtml(name)}</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;color:#dc2626;">${qty}</td>
          </tr>`).join('')}
      </table>`

  const typesHtml = [...byType.entries()].map(([k, v]) => `
    <div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">${escapeHtml(tipoLabel[k] ?? k)}</div>
      <div style="font-size:22px;font-weight:700;color:#0f172a;margin-top:4px;">${v}</div>
    </div>`).join('') || '<div style="color:#64748b;font-style:italic;">Sem tipos.</div>'

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Relatório NG ${dateStr}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;">
  <div style="max-width:760px;margin:0 auto;padding:24px;">
    <div style="background:#354052;color:#fff;border-radius:12px;padding:24px;">
      <div style="font-size:12px;opacity:.7;text-transform:uppercase;letter-spacing:.1em;">MBR Quality • Dashboard NG</div>
      <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;">Relatório de Peças NG</h1>
      <div style="font-size:13px;opacity:.85;">${escapeHtml(fmtDateLong(new Date()))}</div>
    </div>

    ${message ? `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>` : ''}

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
        <thead>
          <tr style="background:#f8fafc;text-align:left;">
            <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Nº</th>
            <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Tipo</th>
            <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Part Number</th>
            <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Fornecedor</th>
            <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Modo Falha</th>
            <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;text-align:right;">Qtd NG</th>
            <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Responsável</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${rows.length > 50 ? `<p style="color:#64748b;font-size:12px;margin:8px 0 0;">Mostrando 50 de ${rows.length} registros. Acesse o app para o relatório completo.</p>` : ''}
    </div>

    <p style="text-align:center;font-size:11px;color:#94a3b8;margin:24px 0 0;">
      MBR Quality — Envio automatizado • ${escapeHtml(dateStr)}
    </p>
  </div>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const body = await req.json().catch(() => ({}))
    const { config_id, log_id, test_to } = body as {
      config_id?: string
      log_id?: string
      test_to?: string
    }

    if (!config_id) {
      return new Response(JSON.stringify({ error: 'config_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: config, error: cfgErr } = await supabase
      .from('email_automation_config')
      .select('*')
      .eq('id', config_id)
      .single()
    if (cfgErr || !config) throw new Error('Config não encontrada')

    // Date range: today (in São Paulo)
    const now = new Date()
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const y = tzDate.getFullYear()
    const m = String(tzDate.getMonth() + 1).padStart(2, '0')
    const d = String(tzDate.getDate()).padStart(2, '0')
    const dayStr = `${y}-${m}-${d}`
    const dateBR = fmtDate(now)

    const { data: rowsData } = await supabase
      .from('apontamentos')
      .select('numero, tipo, part_number, part_name, fornecedor, modo_falha, quantidade_ng, quantidade_inspecionada, responsavel, turno, created_at')
      .gte('data', dayStr)
      .lte('data', dayStr)
      .gt('quantidade_ng', 0)
      .order('created_at', { ascending: false })

    const rows: NgRow[] = (rowsData ?? []) as NgRow[]
    const totalNg = rows.reduce((s, r) => s + (r.quantidade_ng ?? 0), 0)

    const vars: Record<string, string> = {
      date: dateBR,
      day: String(tzDate.getDate()).padStart(2, '0'),
      month: String(tzDate.getMonth() + 1).padStart(2, '0'),
      year: String(y),
      total_ng: String(totalNg),
      total_records: String(rows.length),
    }

    const subject = replaceVars(config.subject_template || 'Relatório NG — {{date}}', vars)
    const messageBody = replaceVars(config.message_body || '', vars)
    const html = buildDashboardHtml(rows, dateBR, messageBody)

    const recipients: string[] = test_to
      ? [test_to]
      : (config.recipients ?? [])

    if (recipients.length === 0) {
      throw new Error('Sem destinatários configurados')
    }

    const senderDomain = Deno.env.get('SENDER_DOMAIN') ?? 'notify.mbrqc.com.br'
    const fromAddr = `informacao@mbrqc.com.br`

    // Enqueue one message per recipient
    const messageIds: string[] = []
    for (const to of recipients) {
      const messageId = crypto.randomUUID()
      const payload = {
        to,
        from: fromAddr,
        sender_domain: senderDomain,
        subject,
        html,
        purpose: 'transactional' as const,
        label: 'ng-daily-report',
        idempotency_key: `${config.id}-${dayStr}-${to}${test_to ? '-test-' + Date.now() : ''}`,
        message_id: messageId,
        queued_at: new Date().toISOString(),
      }
      const { error: enqErr } = await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload,
      })
      if (enqErr) throw enqErr
      messageIds.push(messageId)
    }

    // Log entry
    const isTest = !!test_to
    if (log_id) {
      await supabase
        .from('email_automation_log')
        .update({
          status: 'queued',
          ng_count: rows.length,
          recipients,
          subject,
        })
        .eq('id', log_id)
    } else {
      await supabase.from('email_automation_log').insert({
        config_id: config.id,
        trigger_type: isTest ? 'test' : 'manual',
        recipients,
        subject,
        status: 'queued',
        ng_count: rows.length,
      })
    }

    if (!isTest) {
      await supabase
        .from('email_automation_config')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', config.id)
    }

    return new Response(
      JSON.stringify({ ok: true, queued: messageIds.length, ng_records: rows.length, total_ng: totalNg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('send-automation-email error', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
