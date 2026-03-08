import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDropdownOptions = (category: string) => {
  return useQuery({
    queryKey: ["dropdown_options", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dropdown_options")
        .select("*")
        .eq("category", category)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
};

export const useAddDropdownOption = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (option: { category: string; label: string; value: string; sort_order?: number }) => {
      const { data, error } = await supabase
        .from("dropdown_options")
        .insert(option)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["dropdown_options", vars.category] });
    },
  });
};

export const useDeleteDropdownOption = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase
        .from("dropdown_options")
        .update({ active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["dropdown_options", vars.category] });
    },
  });
};
