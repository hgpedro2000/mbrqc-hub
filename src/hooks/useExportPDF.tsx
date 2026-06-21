import { pdf } from '@react-pdf/renderer';
import { ApontamentoPDF } from '@/components/apontamentos/ApontamentoPDF';
import { supabase } from '@/integrations/supabase/client';

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Falha ao baixar foto', url, e);
    return null;
  }
}

export function useExportPDF() {
  const exportApontamentoPDF = async (apontamentoData: any, photos?: any[]) => {
    try {
      let photoList = photos;
      if (!photoList && apontamentoData.id) {
        const { data } = await supabase
          .from('checklist_photos')
          .select('file_path')
          .eq('checklist_id', apontamentoData.id);
        photoList = data || [];
      }

      const urls = (photoList || [])
        .map((p: any) => {
          if (typeof p === 'string') return p;
          const fp = p.file_path || p.path;
          if (!fp) return null;
          return supabase.storage.from('checklist-photos').getPublicUrl(fp).data.publicUrl;
        })
        .filter(Boolean) as string[];

      // Convert to data URLs so react-pdf renders them reliably (avoids CORS/async issues)
      const fotos = (await Promise.all(urls.map(urlToDataUrl))).filter(Boolean) as string[];

      const dadosCompletos = { ...apontamentoData, fotos };

      const blob = await pdf(<ApontamentoPDF data={dadosCompletos} />).toBlob();

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
