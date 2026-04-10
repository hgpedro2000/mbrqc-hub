
-- Table to persist Matriz de Versatilidade editor authorizations
CREATE TABLE public.matriz_editors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  granted_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.matriz_editors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage matriz_editors"
  ON public.matriz_editors FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own editor status"
  ON public.matriz_editors FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow users with consumiveis_inventario module permission to view all requests
CREATE POLICY "Inventario users can view all requests"
  ON public.consumable_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_module_permissions
      WHERE user_module_permissions.user_id = auth.uid()
        AND user_module_permissions.module = 'consumiveis_inventario'
        AND user_module_permissions.enabled = true
    )
  );

-- Allow users with consumiveis_inventario module permission to update requests (approve/reject)
CREATE POLICY "Inventario users can update requests"
  ON public.consumable_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_module_permissions
      WHERE user_module_permissions.user_id = auth.uid()
        AND user_module_permissions.module = 'consumiveis_inventario'
        AND user_module_permissions.enabled = true
    )
  );
