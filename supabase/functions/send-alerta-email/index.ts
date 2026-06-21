import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FALLBACK = '—'
const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://mbrquality.lovable.app'
const SENDER_DOMAIN = Deno.env.get('SENDER_DOMAIN') ?? 'notify.mbrqc.com.br'
const FROM_ADDR = 'informacao@mbrqc.com.br'

const LINE_AREA_MAP: Record<string, string> = {
  CP: 'cp', BP: 'bp', CH: 'ch', OEM: 'oem',
  Incoming: 'incoming', Pintura: 'pintura', 'Injeção': 'injecao',
  'Sala do Áudio': 'sala_audio', 'Inspeção de Peça': 'inspecao_peca',
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
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return FALLBACK
  const dt = typeof d === 'string' ? new Date(d + 'T12:00:00') : d
  if (isNaN(dt.getTime())) return FALLBACK
  return dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}
function todayInTz(tz = 'America/Sao_Paulo') {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return { dateBR: d.toLocaleDateString('pt-BR'), dayStr: `${y}-${m}-${day}` }
}

async function loadQualifiedInspectors(supabase: any, linhaPeca: string | null) {
  const areaKey = linhaPeca ? LINE_AREA_MAP[linhaPeca] : null
  let q = supabase.from('inspector_qualifications').select('user_id').eq('habilitado', true)
  if (areaKey) q = q.eq('area', areaKey)
  const { data: qualData } = await q
  const ids = [...new Set((qualData ?? []).map((r: any) => r.user_id))]
  if (ids.length === 0) return []
  const { data } = await supabase.from('profiles').select('id, full_name, cargo').in('id', ids)
  return data ?? []
}

function buildImmediateHtml(alerta: any, signers: any[], signed: Set<string>, message: string, qrLink: string) {
  const pendentes = signers.filter(s => !signed.has(s.id))
  const signersHtml = signers.length === 0
    ? `<tr><td colspan="3" style="padding:12px;color:#64748b;font-style:italic;">Sem inspetores qualificados para esta linha/peça.</td></tr>`
    : signers.map(s => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(s.full_name)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;">${escapeHtml(s.cargo)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${signed.has(s.id)
          ? '<span style="color:#16a34a;font-weight:600;">✓ Assinado</span>'
          : '<span style="color:#dc2626;font-weight:600;">Pendente</span>'}</td>
      </tr>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>Alerta de Qualidade #${escapeHtml(alerta.sequencial)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;">
  <div style="max-width:720px;margin:0 auto;padding:24px;">
    <div style="background:#dc2626;color:#fff;border-radius:12px;padding:20px;">
      <div style="font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.1em;">MBR Quality • Alerta de Qualidade</div>
      <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;">Novo Alerta #${escapeHtml(alerta.sequencial)}</h1>
      <div style="font-size:13px;opacity:.9;">${escapeHtml(alerta.modelo)} • ${escapeHtml(alerta.linha_peca)}</div>
    </div>

    ${message ? `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>` : ''}

    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;">
      <h2 style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Detalhes</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${[
          ['Modo de Falha', alerta.modo_falha],
          ['Local Detectado', alerta.local_detectado],
          ['Data Ocorrência', fmtDate(alerta.data_ocorrencia)],
          ['Data Validade', fmtDate(alerta.data_validade)],
          ['Turno', alerta.turno],
          ['Responsabilidade', alerta.responsabilidade],
          ['VIN', alerta.vin],
          ['Emitido por', alerta.emitido_por],
        ].map(([k, v]) => `<tr>
          <td style="padding:6px 0;color:#64748b;width:160px;">${k}</td>
          <td style="padding:6px 0;font-weight:500;">${escapeHtml(v)}</td>
        </tr>`).join('')}
      </table>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Descrição</div>
        <div style="margin-top:6px;font-size:13px;white-space:pre-wrap;">${escapeHtml(alerta.descricao)}</div>
      </div>
    </div>

    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
        <h2 style="margin:0;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Assinaturas necessárias</h2>
        <div style="font-size:12px;color:#64748b;">${signers.length - pendentes.length}/${signers.length} assinaram</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f8fafc;text-align:left;">
          <th style="padding:6px 10px;border-bottom:2px solid #cbd5e1;">Inspetor</th>
          <th style="padding:6px 10px;border-bottom:2px solid #cbd5e1;">Cargo</th>
          <th style="padding:6px 10px;border-bottom:2px solid #cbd5e1;">Status</th>
        </tr></thead>
        <tbody>${signersHtml}</tbody>
      </table>
    </div>

    <div style="background:#354052;color:#fff;border-radius:12px;padding:16px;margin-top:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.1em;">Validação por QR Code</div>
        <div style="font-size:14px;font-weight:600;">Abrir tela de validação deste alerta</div>
      </div>
      <a href="${qrLink}" style="background:#fff;color:#354052;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">Abrir alerta</a>
    </div>

    <p style="text-align:center;font-size:11px;color:#94a3b8;margin:24px 0 0;">MBR Quality — Envio automatizado</p>
  </div>
</body></html>`
}

function buildWeeklyHtml(pending: any[], expired: any[], message: string, periodLabel: string, dateBR: string) {
  const renderRow = (a: any, signedCount: number, total: number, vencido: boolean) => `<tr>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-family:monospace;">#${escapeHtml(a.sequencial)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(a.modelo)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(a.descricao)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;${vencido ? 'color:#dc2626;font-weight:600;' : ''}">${fmtDate(a.data_validade)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${signedCount}/${total}</td>
  </tr>`

  const section = (title: string, items: any[], vencido: boolean, accent: string) => `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;overflow:auto;">
      <h2 style="margin:0 0 12px;font-size:14px;color:${accent};display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${accent};"></span>
        ${title} <span style="color:#64748b;font-weight:400;">(${items.length})</span>
      </h2>
      ${items.length === 0
        ? '<p style="margin:0;color:#64748b;font-style:italic;font-size:13px;">Nenhum registro.</p>'
        : `<table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#f8fafc;text-align:left;">
              <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Nº</th>
              <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Modelo</th>
              <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Descrição</th>
              <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;">Validade</th>
              <th style="padding:8px 10px;border-bottom:2px solid #cbd5e1;text-align:center;">Assinaturas</th>
            </tr></thead>
            <tbody>${items.map(it => renderRow(it.alerta, it.signed, it.total, vencido)).join('')}</tbody>
          </table>`}
    </div>`

  return `<!doctype html><html><head><meta charset="utf-8"><title>Resumo Semanal — Alertas</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;">
  <div style="max-width:760px;margin:0 auto;padding:24px;">
    <div style="background:#354052;color:#fff;border-radius:12px;padding:24px;">
      <div style="font-size:12px;opacity:.7;text-transform:uppercase;letter-spacing:.1em;">MBR Quality • Alertas de Qualidade</div>
      <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;">Resumo Semanal</h1>
      <div style="font-size:13px;opacity:.85;">${escapeHtml(periodLabel)}</div>
    </div>
    ${message ? `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>` : ''}
    <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:160px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Pendentes de assinatura</div>
        <div style="font-size:28px;font-weight:700;color:#d97706;margin-top:4px;">${pending.length}</div>
      </div>
      <div style="flex:1;min-width:160px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Vencidos</div>
        <div style="font-size:28px;font-weight:700;color:#dc2626;margin-top:4px;">${expired.length}</div>
      </div>
    </div>
    ${section('Pendentes de assinatura', pending, false, '#d97706')}
    ${section('Vencidos', expired, true, '#dc2626')}
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin:24px 0 0;">MBR Quality — Envio automatizado • ${escapeHtml(dateBR)}</p>
  </div>
</body></html>`
}

async function buildWeeklyData(supabase: any) {
  const { data: alertas } = await supabase.from('alertas').select('*').eq('status', 'ativo').order('sequencial', { ascending: false })
  const all = alertas ?? []
  if (all.length === 0) return { pending: [], expired: [] }

  const ids = all.map((a: any) => a.id)
  const { data: ciencias } = await supabase.from('ciencias').select('alerta_id, inspetor_id').in('alerta_id', ids)
  const signedByAlerta = new Map<string, Set<string>>()
  for (const c of ciencias ?? []) {
    if (!signedByAlerta.has(c.alerta_id)) signedByAlerta.set(c.alerta_id, new Set())
    signedByAlerta.get(c.alerta_id)!.add(c.inspetor_id)
  }

  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  today.setHours(0, 0, 0, 0)

  const pending: any[] = []
  const expired: any[] = []
  for (const a of all) {
    const signers = await loadQualifiedInspectors(supabase, a.linha_peca)
    const signed = signedByAlerta.get(a.id) ?? new Set()
    const total = signers.length
    const signedCount = signers.filter(s => signed.has(s.id)).length
    const allSigned = total > 0 && signedCount === total
    const isExpired = a.data_validade && new Date(a.data_validade + 'T12:00:00') < today
    if (isExpired) expired.push({ alerta: a, signed: signedCount, total })
    else if (!allSigned) pending.push({ alerta: a, signed: signedCount, total })
  }
  return { pending, expired }
}

async function notifyError(supabase: any, config: any, configId: string, reason: string, dayStr: string, logId: string | null) {
  try {
    const adminList: string[] = (config?.error_notify_recipients?.length ? config.error_notify_recipients : config?.recipients) ?? []
    if (adminList.length === 0) return
    const subject = `[MBR Quality] FALHA — ${config?.name ?? configId}`
    const html = `<!doctype html><body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #fecaca;border-radius:12px;padding:24px;">
        <div style="background:#dc2626;color:#fff;padding:12px;border-radius:8px;margin-bottom:16px;font-weight:600;">⚠️ Falha na automação de e-mails (Alerta)</div>
        <p><strong>Automação:</strong> ${escapeHtml(config?.name ?? '—')}</p>
        <p><strong>Config ID:</strong> <code>${escapeHtml(configId)}</code></p>
        <p><strong>Data:</strong> ${escapeHtml(dayStr)}</p>
        ${logId ? `<p><strong>Log ID:</strong> <code>${escapeHtml(logId)}</code></p>` : ''}
        <p><strong>Motivo:</strong></p>
        <pre style="background:#fef2f2;color:#7f1d1d;padding:12px;border-radius:8px;white-space:pre-wrap;font-size:12px;border:1px solid #fecaca;">${escapeHtml(reason)}</pre>
      </div></body>`
    for (const to of adminList) {
      await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to, from: FROM_ADDR, sender_domain: SENDER_DOMAIN, subject, html,
          purpose: 'transactional', label: 'alerta-automation-error',
          idempotency_key: `err-alerta-${configId}-${dayStr}-${logId ?? 'noLog'}-${to}`,
          message_id: crypto.randomUUID(), queued_at: new Date().toISOString(),
        },
      })
    }
    if (logId) await supabase.from('email_automation_log').update({ error_notified: true }).eq('id', logId)
  } catch (e) { console.error('notifyError failed', e) }
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
      alerta_id, subtipo,
    } = body as {
      config_id?: string; log_id?: string; test_to?: string;
      preview?: boolean; draft?: boolean; resend?: boolean;
      alerta_id?: string; subtipo?: 'imediato' | 'agendado';
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
    const effSubtipo = subtipo ?? config.subtipo ?? 'imediato'

    const { dateBR, dayStr } = todayInTz(config.timezone || 'America/Sao_Paulo')
    dayStrCached = dayStr

    // ===== IMMEDIATE =====
    if (effSubtipo === 'imediato') {
      // For real (event) send: need alerta_id; idempotency by (config_id, entity_id)
      const isReal = !preview && !test_to && !draft && !resend
      let alerta: any = null
      if (alerta_id) {
        const { data } = await supabase.from('alertas').select('*').eq('id', alerta_id).maybeSingle()
        alerta = data
      } else if (test_to || preview) {
        // For test/preview without alerta_id: use the most recent alert
        const { data } = await supabase.from('alertas').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle()
        alerta = data
      }
      if (!alerta) throw new Error('Alerta não encontrado (informe alerta_id ou crie um alerta para testar)')

      if (isReal && alerta_id) {
        const { data: existing } = await supabase.from('email_automation_log')
          .select('id, status').eq('config_id', config.id).eq('entity_id', alerta_id)
          .in('status', ['queued', 'sent', 'pending']).maybeSingle()
        if (existing) {
          return new Response(JSON.stringify({ ok: true, skipped: 'already_sent_for_entity', existing_log_id: existing.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      const signers = await loadQualifiedInspectors(supabase, alerta.linha_peca)
      const { data: cienciasData } = await supabase.from('ciencias').select('inspetor_id').eq('alerta_id', alerta.id)
      const signed = new Set((cienciasData ?? []).map((c: any) => c.inspetor_id))
      const qrLink = `${APP_URL}/alerta-qualidade/ver/${alerta.id}`

      const vars: Record<string, string> = {
        numero_alerta: String(alerta.sequencial ?? ''),
        modelo: alerta.modelo ?? '',
        modo_falha: alerta.modo_falha ?? '',
        linha_peca: alerta.linha_peca ?? '',
        local_detectado: alerta.local_detectado ?? '',
        data_ocorrencia: fmtDate(alerta.data_ocorrencia),
        data_validade: fmtDate(alerta.data_validade),
        turno: alerta.turno ?? '',
        responsabilidade: alerta.responsabilidade ?? '',
        descricao: alerta.descricao ?? '',
        link_qrcode: qrLink,
        date: dateBR,
      }
      const subject = replaceVars(config.subject_template || 'Novo Alerta #{{numero_alerta}} — {{modelo}}', vars)
      const messageBody = replaceVars(config.message_body || '', vars)
      const html = buildImmediateHtml(alerta, signers, signed, messageBody, qrLink)

      if (preview) {
        return new Response(JSON.stringify({ ok: true, preview: true, subject, html, alerta_id: alerta.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (draft) {
        const { data: ins } = await supabase.from('email_automation_log').insert({
          config_id: config.id, modulo: 'alerta_qualidade', tipo_disparo: 'evento',
          trigger_type: 'draft', status: 'draft', recipients: config.recipients ?? [],
          subject, preview_html: html, send_date: dayStr, entity_id: alerta.id,
        }).select('id').single()
        return new Response(JSON.stringify({ ok: true, draft: true, draft_id: ins?.id, subject, html }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const recipients: string[] = test_to ? [test_to] : Array.from(new Set((config.recipients ?? []).filter(Boolean)))
      if (recipients.length === 0) throw new Error('Sem destinatários configurados')

      for (const to of recipients) {
        await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            to, from: FROM_ADDR, sender_domain: SENDER_DOMAIN, subject, html,
            purpose: 'transactional', label: 'alerta-immediate',
            idempotency_key: `alerta-${config.id}-${alerta.id}-${to}${test_to ? `-test-${Date.now()}` : ''}${resend ? `-r${Date.now()}` : ''}`,
            message_id: crypto.randomUUID(), queued_at: new Date().toISOString(),
          },
        })
      }

      const trigger_type = test_to ? 'test' : (resend ? 'manual' : 'evento')
      if (log_id) {
        await supabase.from('email_automation_log').update({
          status: 'queued', recipients, subject, send_date: dayStr,
        }).eq('id', log_id)
      } else {
        await supabase.from('email_automation_log').insert({
          config_id: config.id, modulo: 'alerta_qualidade', tipo_disparo: 'evento',
          trigger_type, status: 'queued', recipients, subject,
          send_date: dayStr, entity_id: test_to ? null : alerta.id,
        })
      }
      if (!test_to && !resend) {
        await supabase.from('email_automation_config').update({ last_sent_at: new Date().toISOString() }).eq('id', config.id)
      }
      return new Response(JSON.stringify({ ok: true, queued: recipients.length, subject }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ===== WEEKLY DIGEST =====
    const isReal = !preview && !test_to && !draft && !resend
    if (isReal) {
      const { data: existing } = await supabase.from('email_automation_log')
        .select('id').eq('config_id', config.id).eq('send_date', dayStr)
        .in('trigger_type', ['scheduled', 'manual'])
        .in('status', ['queued', 'sent', 'pending']).maybeSingle()
      if (existing && (!log_id || existing.id !== log_id)) {
        return new Response(JSON.stringify({ ok: true, skipped: 'already_sent_today', existing_log_id: existing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const { pending, expired } = await buildWeeklyData(supabase)
    const periodLabel = `Semana até ${dateBR}`
    const vars: Record<string, string> = {
      date: dateBR, period: periodLabel,
      total_pendentes: String(pending.length), total_vencidos: String(expired.length),
    }
    const subject = replaceVars(config.subject_template || 'Resumo Semanal — Alertas', vars)
    const messageBody = replaceVars(config.message_body || '', vars)
    const html = buildWeeklyHtml(pending, expired, messageBody, periodLabel, dateBR)

    if (preview) {
      return new Response(JSON.stringify({
        ok: true, preview: true, subject, html,
        total_pendentes: pending.length, total_vencidos: expired.length,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (draft) {
      const { data: ins } = await supabase.from('email_automation_log').insert({
        config_id: config.id, modulo: 'alerta_qualidade', tipo_disparo: 'agendado',
        trigger_type: 'draft', status: 'draft', recipients: config.recipients ?? [],
        subject, preview_html: html, send_date: dayStr,
      }).select('id').single()
      return new Response(JSON.stringify({ ok: true, draft: true, draft_id: ins?.id, subject, html }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const recipients: string[] = test_to ? [test_to] : Array.from(new Set((config.recipients ?? []).filter(Boolean)))
    if (recipients.length === 0) throw new Error('Sem destinatários configurados')

    const triggerSuffix = resend ? `-r${Date.now()}` : (test_to ? `-test-${Date.now()}` : '')
    for (const to of recipients) {
      await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to, from: FROM_ADDR, sender_domain: SENDER_DOMAIN, subject, html,
          purpose: 'transactional', label: 'alerta-weekly',
          idempotency_key: `alerta-weekly-${config.id}-${dayStr}-${to}${triggerSuffix}`,
          message_id: crypto.randomUUID(), queued_at: new Date().toISOString(),
        },
      })
    }

    if (log_id) {
      await supabase.from('email_automation_log').update({
        status: 'queued', recipients, subject, send_date: dayStr,
      }).eq('id', log_id)
    } else {
      await supabase.from('email_automation_log').insert({
        config_id: config.id, modulo: 'alerta_qualidade', tipo_disparo: 'agendado',
        trigger_type: test_to ? 'test' : 'manual', status: 'queued',
        recipients, subject, send_date: dayStr,
      })
    }
    if (!test_to && !resend) {
      await supabase.from('email_automation_config').update({ last_sent_at: new Date().toISOString() }).eq('id', config.id)
    }
    return new Response(JSON.stringify({ ok: true, queued: recipients.length, subject }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('send-alerta-email error', msg)
    try {
      if (logIdInProgress) {
        await supabase.from('email_automation_log').update({
          status: 'failed', error_message: msg.slice(0, 1000),
        }).eq('id', logIdInProgress)
      } else if (body?.config_id && !body?.preview && !body?.draft) {
        await supabase.from('email_automation_log').insert({
          config_id: body.config_id, modulo: 'alerta_qualidade',
          tipo_disparo: body?.alerta_id ? 'evento' : 'agendado',
          trigger_type: body?.test_to ? 'test' : 'manual',
          recipients: body?.test_to ? [body.test_to] : [],
          status: 'failed', error_message: msg.slice(0, 1000),
          send_date: dayStrCached || null, entity_id: body?.alerta_id ?? null,
        })
      }
      if (configCached && body?.config_id && !body?.preview && !body?.draft) {
        await notifyError(supabase, configCached, body.config_id, msg, dayStrCached, logIdInProgress)
      }
    } catch (logErr) { console.error('failed to log error', logErr) }
    return new Response(JSON.stringify({ error: msg, config_id: body?.config_id ?? null }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
