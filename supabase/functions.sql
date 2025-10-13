-- Função para limpar tentativas concluídas há +30 dias
CREATE OR REPLACE FUNCTION public.cleanup_old_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.attempts
  WHERE completed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;