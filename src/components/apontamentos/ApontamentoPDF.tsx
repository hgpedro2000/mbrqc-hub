import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 32,
    backgroundColor: '#0F172A',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #334155',
    paddingBottom: 12,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTipo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#60A5FA',
    letterSpacing: 1,
  },
  headerNumero: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  headerStatus: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#22C55E',
    backgroundColor: '#166534',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  headerData: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 14,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderRadius: 6,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 8,
    color: '#94A3B8',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    border: '1px solid #334155',
  },
  cardTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: '1px solid #2D3748',
  },
  rowLast: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  label: {
    fontSize: 8,
    color: '#94A3B8',
    width: '30%',
  },
  value: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#F1F5F9',
    width: '70%',
  },
  valueMonospace: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#F1F5F9',
    fontFamily: 'Courier',
    width: '70%',
  },
  rowGrid: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: '1px solid #2D3748',
  },
  gridItem: {
    flexDirection: 'row',
    width: '50%',
  },
  gridLabel: {
    fontSize: 8,
    color: '#94A3B8',
    width: '35%',
  },
  gridValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#F1F5F9',
    width: '65%',
  },
  defectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottom: '1px solid #2D3748',
  },
  defectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  defectIndex: {
    fontSize: 8,
    color: '#94A3B8',
    width: 16,
  },
  defectModo: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#F87171',
  },
  defectDesc: {
    fontSize: 8,
    color: '#CBD5E1',
    fontStyle: 'italic',
  },
  defectRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  defectQty: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FACC15',
  },
  defectTag: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#0F172A',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: 'Courier',
  },
  alcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#064E3B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  alcText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6EE7B7',
  },
  footer: {
    marginTop: 20,
    borderTop: '1px solid #334155',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#64748B',
  },
  footerVersao: {
    fontSize: 7,
    color: '#475569',
  },
});

interface ApontamentoPDFProps {
  data: {
    numero: string;
    tipo: string;
    data: string;
    turno: string;
    tempo_inspecao: string;
    responsavel: string;
    co_inspetores: string[];
    projeto: string;
    fornecedor: string;
    part_number: string;
    part_name: string;
    lote_inspecionado: string;
    fase: string;
    local_deteccao: string;
    quantidade_inspecionada: number;
    quantidade_ok: number;
    quantidade_ng: number;
    modo_falha: string | null;
    descricao: string;
    responsabilidade_defeito: string | null;
    segundo_defeitos: Array<{
      modo_falha: string;
      descricao: string;
      qty: number;
      tag: string;
    }>;
    alc_code: string;
    alc_expected: string;
    alc_validation_method: string | null;
    alc_validation_status: string | null;
    parada_linha: string;
    status: string;
    numero_tag?: string;
  };
}

export function ApontamentoPDF({ data }: ApontamentoPDFProps) {
  const cleanMode = (mode: string) => mode?.replace(/^\d+\s*-\s*/, '') || mode;

  const allDefeitos: Array<{ modo: string; desc: string; qty: number; tag: string }> = [];
  if (data.modo_falha && data.quantidade_ng > 0) {
    const qtySecundarios = data.segundo_defeitos?.reduce((acc: number, d: any) => acc + d.qty, 0) || 0;
    allDefeitos.push({
      modo: cleanMode(data.modo_falha),
      desc: data.descricao || 'Sem descrição',
      qty: data.quantidade_ng - qtySecundarios,
      tag: data.numero_tag || 'N/A',
    });
  }
  if (data.segundo_defeitos?.length) {
    data.segundo_defeitos.forEach((d: any) => {
      allDefeitos.push({
        modo: cleanMode(d.modo_falha),
        desc: d.descricao || '',
        qty: d.qty,
        tag: d.tag || 'N/A',
      });
    });
  }

  const temDefeito = data.quantidade_ng > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTipo}>INCOMING</Text>
            <Text style={styles.headerNumero}>• {data.numero}</Text>
            <Text style={styles.headerStatus}>
              {data.status === 'submitted' ? '✓ FINALIZADO' : '⏳ RASCUNHO'}
            </Text>
          </View>
          <Text style={styles.headerData}>
            {data.data} • {data.turno}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#60A5FA' }]}>
              {data.quantidade_inspecionada}
            </Text>
            <Text style={styles.statLabel}>INSPECIONADA</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4ADE80' }]}>
              {data.quantidade_ok}
            </Text>
            <Text style={styles.statLabel}>OK</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#F87171' }]}>
              {data.quantidade_ng}
            </Text>
            <Text style={styles.statLabel}>NG</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>IDENTIFICAÇÃO</Text>
          <View style={styles.rowGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>NÚMERO</Text>
              <Text style={styles.gridValue}>{data.numero}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>DATA</Text>
              <Text style={styles.gridValue}>{data.data}</Text>
            </View>
          </View>
          <View style={styles.rowGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>APONTADO POR</Text>
              <Text style={styles.gridValue}>{data.responsavel}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>TURNO</Text>
              <Text style={styles.gridValue}>{data.turno}</Text>
            </View>
          </View>
          <View style={styles.rowGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>EMPRESA</Text>
              <Text style={styles.gridValue}>Mobis Brasil</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>ORIGEM</Text>
              <Text style={styles.gridValue}>LP</Text>
            </View>
          </View>
          <View style={styles.rowGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>PROJETO</Text>
              <Text style={styles.gridValue}>{data.projeto}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>FORNECEDOR</Text>
              <Text style={styles.gridValue}>{data.fornecedor}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>PART NUMBER</Text>
            <Text style={styles.valueMonospace}>{data.part_number}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.label}>PART NAME</Text>
            <Text style={styles.value}>{data.part_name}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>INSPEÇÃO</Text>
          <View style={styles.row}>
            <Text style={styles.label}>TEMPO DE INSPEÇÃO</Text>
            <Text style={styles.value}>{data.tempo_inspecao}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.label}>CO-INSPETORES</Text>
            <Text style={styles.value}>
              {data.co_inspetores?.length ? data.co_inspetores.join(', ') : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>DADOS DA INSPEÇÃO</Text>
          <View style={styles.rowGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>LOCAL</Text>
              <Text style={styles.gridValue}>{data.local_deteccao || data.fase}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>QTD. INSPECIONADA</Text>
              <Text style={styles.gridValue}>{data.quantidade_inspecionada}</Text>
            </View>
          </View>
          <View style={styles.rowGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>QTD. OK</Text>
              <Text style={[styles.gridValue, { color: '#4ADE80' }]}>{data.quantidade_ok}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>QTD. NG</Text>
              <Text style={[styles.gridValue, { color: '#F87171' }]}>{data.quantidade_ng}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>LOTE INSPECIONADO</Text>
            <Text style={styles.valueMonospace}>{data.lote_inspecionado}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>SPEC ALC</Text>
            <Text style={styles.valueMonospace}>{data.alc_code || 'N/A'}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.label}>VALIDAÇÃO ALC</Text>
            {data.alc_validation_status === 'ok' ? (
              <View style={styles.alcBadge}>
                <Text style={styles.alcText}>✓ Validado OK — {data.alc_code}</Text>
                <Text style={{ fontSize: 7, color: '#6EE7B7' }}>
                  via {data.alc_validation_method === 'qr' ? 'QR Code' : 'Manual'}
                </Text>
              </View>
            ) : (
              <Text style={[styles.value, { color: '#94A3B8' }]}>Não validado</Text>
            )}
          </View>
          <View style={{ marginTop: 4 }}>
            <View style={styles.row}>
              <Text style={styles.label}>RESPONSABILIDADE</Text>
              <Text style={[styles.value, { color: '#FCD34D' }]}>
                {data.responsabilidade_defeito || 'PART'}
              </Text>
            </View>
            <View style={styles.rowLast}>
              <Text style={styles.label}>PARADA DE LINHA</Text>
              <Text style={[styles.value, { color: data.parada_linha === 'sim' ? '#F87171' : '#4ADE80' }]}>
                {data.parada_linha === 'sim' ? 'SIM' : 'NÃO'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>DETALHAMENTO POR MODO DE FALHA</Text>
          {temDefeito && allDefeitos.length > 0 ? (
            allDefeitos.map((def, idx) => (
              <View key={idx} style={styles.defectItem}>
                <View style={styles.defectLeft}>
                  <Text style={styles.defectIndex}>{idx + 1}.</Text>
                  <Text style={styles.defectModo}>{def.modo}</Text>
                  {def.desc && <Text style={styles.defectDesc}>— {def.desc}</Text>}
                </View>
                <View style={styles.defectRight}>
                  <Text style={styles.defectQty}>Qty: {def.qty}</Text>
                  <Text style={styles.defectTag}>TAG: {def.tag}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 9, color: '#94A3B8', paddingVertical: 4 }}>
              ✓ Sem defeitos encontrados durante esta inspeção
            </Text>
          )}
          {temDefeito && allDefeitos.length > 0 && (
            <View style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #2D3748' }}>
              <Text style={{ fontSize: 8, color: '#94A3B8' }}>
                TAGs inseridas: {allDefeitos.filter(d => d.tag !== 'N/A').length}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>FOTOS</Text>
          <Text style={{ fontSize: 8, color: '#64748B' }}>
            {data.quantidade_ng > 0 ? '📷 ' : ''}
            Este relatório foi gerado com base nos dados do apontamento.
            {data.quantidade_ng > 0 && ' As fotos estão disponíveis no sistema.'}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Hyundai Mobis — Apontamento Control</Text>
          <Text style={styles.footerVersao}>
            Gerado em {new Date().toLocaleDateString('pt-BR')} • v{import.meta.env.VITE_APP_VERSION || '1.0.0'}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
