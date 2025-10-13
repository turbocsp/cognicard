-- Ativar RLS em todas as tabelas principais
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_log ENABLE ROW LEVEL SECURITY;

-- Usuário só pode ver e modificar seus próprios registros

-- cards
CREATE POLICY "Users can manage own cards"
ON public.cards
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- decks
CREATE POLICY "Users can manage own decks"
ON public.decks
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- folders
CREATE POLICY "Users can manage own folders"
ON public.folders
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- attempts
CREATE POLICY "Users can manage own attempts"
ON public.attempts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- study_log
CREATE POLICY "Users can read/write own study logs"
ON public.study_log
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);