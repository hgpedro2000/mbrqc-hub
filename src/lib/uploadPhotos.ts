import { supabase } from "@/integrations/supabase/client";

export async function uploadPhotos(
  files: File[],
  checklistId: string,
  checklistType: "injection" | "painting" | "assembly"
) {
  const results: { file_path: string; file_name: string }[] = [];

  for (const file of files) {
    const ext = file.name.split(".").pop();
    const filePath = `${checklistType}/${checklistId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("checklist-photos")
      .upload(filePath, file);

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
