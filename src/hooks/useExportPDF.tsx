import { pdf } from '@react-pdf/renderer';
import { ApontamentoPDF } from '@/components/apontamentos/ApontamentoPDF';

export function useExportPDF() {
  const exportApontamentoPDF = async (apontamentoData: any) => {
    try {
      const blob = await pdf(
        <ApontamentoPDF data={apontamentoData} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `apontamento-${apontamentoData.numero}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      return { success: false, error };
    }
  };

  return { exportApontamentoPDF };
}
