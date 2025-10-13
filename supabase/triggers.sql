-- Exemplo: atualiza data no study_log
CREATE OR REPLACE FUNCTION public.update_study_log_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_study_log_timestamp
BEFORE INSERT ON public.study_log
FOR EACH ROW
EXECUTE FUNCTION public.update_study_log_timestamp();