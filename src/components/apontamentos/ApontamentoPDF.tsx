import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    paddingTop: 35,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '2px solid #E2E8F0',
    paddingBottom: 10,
    marginBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTipo: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', letterSpacing: 0.5 },
  headerNumero: { fontSize: 16, fontWeight: 'bold', color: '#3B82F6' },
  headerStatus: {
    fontSize: 10, fontWeight: 'bold', color: '#FFFFFF',
    backgroundColor: '#22C55E', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4,
  },
  headerData: { fontSize: 10, color: '#64748B', textAlign: 'right' },

  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginVertical: 12, paddingVertical: 12,
    backgroundColor: '#F1F5F9', borderRadius: 8, border: '1px solid #E2E8F0',
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 8, color: '#64748B', marginTop: 2, letterSpacing: 0.5 },

  card: {
    backgroundColor: '#F8FAFC', borderRadius: 6, padding: 12,
    marginBottom: 10, border: '1px solid #E2E8F0',
  },
  cardTitle: {
    fontSize: 10, fontWeight: 'bold', color: '#475569',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
    borderBottom: '1px solid #E2E8F0', paddingBottom: 6,
  },

  row: { flexDirection: 'row', paddingVertical: 3, borderBottom: '1px solid #F1F5F9' },
  rowLast: { flexDirection: 'row', paddingVertical: 3 },
  label: { fontSize: 8, color: '#64748B', width: '28%' },
  value: { fontSize: 9, fontWeight: 'bold', color: '#0F172A', width: '72%' },
  valueMonospace: { fontSize: 8, fontWeight: 'bold', color: '#0F172A', fontFamily: 'Courier', width: '72%' },

  rowGrid: { flexDirection: 'row', paddingVertical: 3, borderBottom: '1px solid #F1F5F9' },
  gridItem: { flexDirection: 'row', width: '50%' },
  gridLabel: { fontSize: 8, color: '#64748B', width: '30%' },
  gridValue: { fontSize: 9, fontWeight: 'bold', color: '#0F172A', width: '70%' },

  defectItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, borderBottom: '1px solid #F1F5F9',
  },
  defectLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  defectIndex: { fontSize: 8, color: '#94A3B8', width: 16 },
  defectModo: { fontSize: 9, fontWeight: 'bold', color: '#DC2626' },
  defectDesc: { fontSize: 8, color: '#475569', fontStyle: 'italic' },
  defectRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  defectQty: { fontSize: 9, fontWeight: 'bold', color: '#EAB308' },
  defectTag: {
    fontSize: 7, fontWeight: 'bold', color: '#0F172A',
    backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 3, fontFamily: 'Courier',
  },

  alcBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 4, alignSelf: 'flex-start',
  },
  alcText: { fontSize: 9, fontWeight: 'bold', color: '#166534' },

  photosContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  photoItem: {
    width: '48%', border: '1px solid #E2E8F0', borderRadius: 4,
    overflow: 'hidden', backgroundColor: '#F1F5F9', marginBottom: 4,
  },
  photoImage: { width: '100%', height: 140, objectFit: 'cover' },

  footer: {
    marginTop: 20, borderTop: '1px solid #E2E8F0', paddingTop: 10,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: '#94A3B8' },
  footerVersao: { fontSize: 7, color: '#94A3B8' },

  respBadge: {
    backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 3, alignSelf: 'flex-start',
  },
  respText: { fontSize: 8, fontWeight: 'bold', color: '#D97706' },
});

interface ApontamentoPDFProps {
  data: any;
}

export function ApontamentoPDF({ data }: ApontamentoPDFProps) {
  const cleanMode = (mode: string) => mode?.replace(/^\d+\s*-\s*/, '') || mode;

  const allDefeitos: Array<{ modo: string; desc: string; qty: number; tag: string }> = [];
  if (data.modo_falha && data.quantidade_ng > 0) {
    const qtySecundarios = data.segundo_defeitos?.reduce((acc: number, d: any) => acc + (d.qty || 0), 0) || 0;
    allDefeitos.push({
      modo: cleanMode(data.modo_falha),
      desc: data.descricao || '',
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
  const fotos: string[] = data.fotos || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTipo}>Incoming</Text>
            <Text style={styles.headerNumero}>• {data.numero}</Text>
            <Text style={styles.headerStatus}>
              {data.status === 'submitted' ? 'FINALIZADO' : 'RASCUNHO'}
            </Text>
          </View>
          <Text style={styles.headerData}>
            {data.responsavel} • {data.data} • {data.turno}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#3B82F6' }]}>{data.quantidade_inspecionada}</Text>
            <Text style={styles.statLabel}>INSPECIONADA</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#22C55E' }]}>{data.quantidade_ok}</Text>
            <Text style={styles.statLabel}>OK</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#EF4444' }]}>{data.quantidade_ng}</Text>
            <Text style={styles.statLabel}>NG</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>IDENTIFICAÇÃO</Text>
          <View style={styles.rowGrid}>
            <View style={styles.gridItem}><Text style={styles.gridLabel}>NÚMERO</Text><Text style={styles.gridValue}>{data.numero}</Text></View>
            <View style={styles.gridItem}><Text style={styles.gridLabel}>DATA</Text><Text style={styles.gridValue}>{data.data}</Text></View>
          </View>
          <View style={styles.rowGrid}>
            <View style={styles.gridItem}><Text style={styles.gridLabel}>APONTADO POR</Text><Text style={styles.gridValue}>{data.responsavel}</Text></View>
            <View style={styles.gridItem}><Text style={styles.gridLabel}>TURNO</Text><Text style={styles.gridValue}>{data.turno}</Text></View>
          </View>
          <View style={styles.rowGrid}>
            <View style={styles.gridItem}><Text style={styles.gridLabel}>PROJETO</Text><Text style={styles.gridValue}>{data.projeto}</Text></View>
            <View style={styles.gridItem}><Text style={styles.gridLabel}>FORNECEDOR</Text><Text style={styles.gridValue}>{data.fornecedor}</Text></View>
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
            <Text style={styles.value}>{data.tempo_inspecao || '—'}</Text>
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
            <View style={styles.gridItem}><Text style={styles.gridLabel}>LOCAL</Text><Text style={styles.gridValue}>{data.local_deteccao || data.fase || '—'}</Text></View>
            <View style={styles.gridItem}><Text style={styles.gridLabel}>QTD. INSPECIONADA</Text><Text style={styles.gridValue}>{data.quantidade_inspecionada}</Text></View>
          </View>
          <View style={styles.rowGrid}>
            <View style={styles.gridItem}><Text style={styles.gridLabel}>QTD. OK</Text><Text style={[styles.gridValue, { color: '#22C55E' }]}>{data.quantidade_ok}</Text></View>
            <View style={styles.gridItem}><Text style={styles.gridLabel}>QTD. NG</Text><Text style={[styles.gridValue, { color: '#EF4444' }]}>{data.quantidade_ng}</Text></View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>LOTE INSPECIONADO</Text>
            <Text style={styles.valueMonospace}>{data.lote_inspecionado || '—'}</Text>
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
              </View>
            ) : (
              <Text style={[styles.value, { color: '#94A3B8' }]}>Não validado</Text>
            )}
          </View>
          <View style={{ marginTop: 4 }}>
            <View style={styles.row}>
              <Text style={styles.label}>RESPONSABILIDADE</Text>
              <View style={styles.respBadge}>
                <Text style={styles.respText}>{cleanMode(data.responsabilidade_defeito || 'PART')}</Text>
              </View>
            </View>
            <View style={styles.rowLast}>
              <Text style={styles.label}>PARADA DE LINHA</Text>
              <Text style={[styles.value, { color: data.parada_linha === 'sim' ? '#DC2626' : '#22C55E' }]}>
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
                  {def.desc ? <Text style={styles.defectDesc}>— {def.desc}</Text> : null}
                </View>
                <View style={styles.defectRight}>
                  <Text style={styles.defectQty}>Qty: {def.qty}</Text>
                  <Text style={styles.defectTag}>TAG: {def.tag}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 9, color: '#64748B', paddingVertical: 4 }}>
              ✓ Sem defeito encontrado durante essa inspeção
            </Text>
          )}
        </View>

        <View style={styles.card} wrap={false}>
          <Text style={styles.cardTitle}>FOTOS ({fotos.length})</Text>
          {fotos.length > 0 ? (
            <View style={styles.photosContainer}>
              {fotos.map((fotoUrl, index) => (
                <View key={index} style={styles.photoItem}>
                  <Image src={fotoUrl} style={styles.photoImage} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 9, color: '#94A3B8', paddingVertical: 4 }}>
              Nenhuma foto anexada a este apontamento.
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Hyundai Mobis — Apontamento Control</Text>
          <Text style={styles.footerVersao}>Gerado em {new Date().toLocaleDateString('pt-BR')}</Text>
        </View>
      </Page>
    </Document>
  );
}
