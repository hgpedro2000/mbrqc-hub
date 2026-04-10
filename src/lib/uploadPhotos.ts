import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compressImage";

export async function uploadPhotos(
  files: File[],
  checklistId: string,
  checklistType: "injection" | "painting" | "assembly" | "apontamento"
) {
  const results: { file_path: string; file_name: string }[] = [];

  for (const file of files) {
    // Compress before upload
    const compressed = await compressImage(file);
    const ext = compressed.name.split(".").pop();
    const filePath = `${checklistType}/${checklistId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("checklist-photos")
      .upload(filePath, compressed);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      continue;
    }

    results.push({ file_path: filePath, file_name: file.name });
  }

  if (results.length > 0) {
    const { error } = await supabase.from("checklist_photos").insert(
      results.map((r) => ({
        checklist_id: checklistId,
        checklist_type: checklistType,
        file_path: r.file_path,
        file_name: r.file_name,
      }))
    );
    if (error) console.error("Photo records error:", error);
  }

  return results;
}
