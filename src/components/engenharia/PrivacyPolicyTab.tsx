import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Eye, FileText, Loader2 } from "lucide-react";
import { renderMarkdown } from "@/lib/renderMarkdown";
import { logAction } from "@/lib/logAction";

const PrivacyPolicyTab = () => {
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "privacy_policy")
        .maybeSingle();
      const val = data?.value || "";
      setContent(val);
      setOriginal(val);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // upsert via update first; if no row, insert
      const { data: existing } = await supabase
        .from("app_config")
        .select("key")
        .eq("key", "privacy_policy")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("app_config")
          .update({ value: content })
          .eq("key", "privacy_policy");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_config")
          .insert({ key: "privacy_policy", value: content });
        if (error) throw error;
      }

      setOriginal(content);
      toast.success("Política de Privacidade atualizada");
      logAction("update_privacy_policy", "Engenharia", { length: content.length });
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const isDirty = content !== original;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileText className="w-5 h-5 text-accent" />
            Política de Privacidade
          </CardTitle>
          <Button onClick={handleSave} disabled={!isDirty || saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Edite o conteúdo em Markdown. Suporta # cabeçalhos, **negrito** e - listas.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="edit">
          <TabsList>
            <TabsTrigger value="edit">Editor</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="w-3.5 h-3.5 mr-1" /> Pré-visualizar</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-4">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[500px] font-mono text-xs"
              placeholder="# Política de Privacidade..."
            />
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <article
              className="prose prose-invert prose-sm max-w-none border border-border rounded-lg p-4 bg-muted/20
                prose-headings:font-heading prose-headings:text-foreground
                prose-h1:text-xl prose-h2:text-lg prose-h2:text-accent
                prose-p:text-foreground/90 prose-strong:text-foreground prose-li:text-foreground/90"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PrivacyPolicyTab;
