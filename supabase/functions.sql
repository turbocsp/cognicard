-- Função para limpar tentativas concluídas há +30 dias
CREATE OR REPLACE FUNCTION public.cleanup_old_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.attempts
  WHERE completed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.delete_all_cards_from_deck(p_deck_id uuid)
RETURNS void
LANGUAGE plpgsql
-- SECURITY DEFINER é necessário para permitir que a função apague
-- múltiplas linhas que pertencem ao utilizador que a chama.
SECURITY DEFINER
AS $$
BEGIN
  -- Verificação de Segurança: Garante que o utilizador que chama a função
  -- é, de facto, o dono do baralho.
  IF NOT EXISTS (
    SELECT 1
    FROM public.decks
    WHERE id = p_deck_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado: Você não é o dono deste baralho.';
  END IF;

  -- Ação: Apaga todas as cartas ONDE o deck_id corresponde E o user_id corresponde.
  -- A verificação do user_id aqui é uma dupla garantia de segurança.
  DELETE FROM public.cards
  WHERE deck_id = p_deck_id AND user_id = auth.uid();
END;
$$;


CREATE OR REPLACE FUNCTION public.search_cards(search_term text, p_user_id uuid)
RETURNS TABLE(id uuid, front_content text, back_content text, tags text[], deck_id uuid, deck_name text)
LANGUAGE plpgsql
AS $$
DECLARE
    query tsquery;
    -- 1. Transforma o termo de busca em lexemas (palavras-raiz)
    -- Ex: "Planejamento de Auditoria" -> {'planejament', 'auditor'}
    lexemes text[] := tsvector_to_array(to_tsvector('portuguese', unaccent(search_term)));
    
    -- 2. Transforma cada lexema num termo de busca por prefixo
    -- Ex: {'planejament', 'auditor'} -> 'planejament:* & auditor:*'
    query_string text := array_to_string(
        ARRAY(SELECT lexeme || ':*' FROM unnest(lexemes) AS t(lexeme)),
        ' & '
    );
BEGIN
    -- 3. Converte a string final para um tsquery
    -- Se a string estiver vazia (ex: busca por "e" ou "de"), usa plainto_tsquery para evitar erro
    IF query_string = '' THEN
        query := plainto_tsquery('portuguese', unaccent(search_term));
    ELSE
        query := to_tsquery('portuguese', query_string);
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.front_content,
        c.back_content,
        c.tags,
        c.deck_id,
        d.name as deck_name
    FROM
        public.cards AS c
    JOIN
        public.decks AS d ON c.deck_id = d.id
    WHERE
        -- A Política de Segurança RLS (que já tem) garante a separação por utilizador
        c.user_id = p_user_id
        -- 4. A busca @@ funciona da mesma forma, mas agora com prefixos
        AND c.fts @@ query
    ORDER BY
        -- Classifica os resultados pela relevância
        ts_rank(c.fts, query) DESC;
END;
$$;


CREATE OR REPLACE FUNCTION public.search_cards(search_term text, p_user_id uuid)
RETURNS TABLE(id uuid, front_content text, back_content text, tags text[], deck_id uuid, deck_name text)
LANGUAGE plpgsql
AS $$
DECLARE
    query tsquery;
BEGIN
    -- Converte o termo de busca para um 'tsquery' sem acentos,
    -- usando a configuração 'portuguese' e o formato websearch.
    -- Ex: "Planejamento Auditoria" vira "planejament & auditor"
    query := websearch_to_tsquery('portuguese', unaccent(search_term));

    RETURN QUERY
    SELECT
        c.id,
        c.front_content,
        c.back_content,
        c.tags,
        c.deck_id,
        d.name as deck_name
    FROM
        public.cards AS c
    JOIN
        public.decks AS d ON c.deck_id = d.id
    WHERE
        -- A Política de Segurança RLS (que já tem) garante a separação por utilizador
        c.user_id = p_user_id
        -- Esta é a nova busca rápida que usa o índice GIN (@@)
        AND c.fts @@ query
    ORDER BY
        -- Opcional: Classifica os resultados pela relevância (matches no 'A' vêm primeiro)
        ts_rank(c.fts, query) DESC;
END;
$$;


CREATE INDEX cards_fts_idx ON public.cards USING gin(fts);


CREATE OR REPLACE FUNCTION public.update_card_fts_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fts :=
        setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.front_content, ''))), 'A') ||
        setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.back_content, ''))), 'B') ||
        setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.theory_notes, ''))), 'C') ||
        setweight(to_tsvector('portuguese', unaccent(array_to_string(NEW.tags, ' '))), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


ALTER TABLE public.cards
ADD COLUMN fts tsvector;


-- Para BARALHOS (decks):
-- 1. Garante nomes únicos para baralhos na RAIZ (onde folder_id É NULL)
CREATE UNIQUE INDEX decks_user_id_name_root_idx
ON public.decks (user_id, name)
WHERE folder_id IS NULL;

-- 2. Garante nomes únicos para baralhos DENTRO DE PASTAS (onde folder_id NÃO É NULL)
CREATE UNIQUE INDEX decks_user_id_name_folder_id_idx
ON public.decks (user_id, name, folder_id)
WHERE folder_id IS NOT NULL;


-- Para PASTAS (folders):
-- 3. Garante nomes únicos para pastas na RAIZ (onde parent_folder_id É NULL)
CREATE UNIQUE INDEX folders_user_id_name_root_idx
ON public.folders (user_id, name)
WHERE parent_folder_id IS NULL;

-- 4. Garante nomes únicos para pastas DENTRO DE OUTRAS PASTAS (onde parent_folder_id NÃO É NULL)
CREATE UNIQUE INDEX folders_user_id_name_parent_folder_id_idx
ON public.folders (user_id, name, parent_folder_id)
WHERE parent_folder_id IS NOT NULL;


-- supabase/functions.sql (ou adicione ao existente)

CREATE OR REPLACE FUNCTION public.get_daily_study_times(
    p_user_id uuid,
    p_date date -- Data no fuso horário local (ex: 'YYYY-MM-DD')
)
RETURNS TABLE(deck_id uuid, total_seconds_deck bigint, total_seconds_all bigint) AS $$
DECLARE
    v_total_all bigint;
BEGIN
    -- Calcula o total geral para o dia e usuário
    SELECT COALESCE(SUM(a.elapsed_seconds), 0)
    INTO v_total_all
    FROM public.attempts a
    WHERE a.user_id = p_user_id
      AND (a.completed_at AT TIME ZONE 'America/Sao_Paulo')::date = p_date; -- Ajuste o fuso se necessário

    -- Retorna o total por deck e o total geral
    RETURN QUERY
    SELECT
        a.deck_id,
        COALESCE(SUM(a.elapsed_seconds), 0) as total_seconds_deck,
        v_total_all as total_seconds_all
    FROM public.attempts a
    WHERE a.user_id = p_user_id
      AND (a.completed_at AT TIME ZONE 'America/Sao_Paulo')::date = p_date -- Ajuste o fuso se necessário
    GROUP BY a.deck_id;

    -- Se não houver nenhuma tentativa no dia, retorna uma linha com 0 para evitar resultado vazio
    IF NOT FOUND THEN
       RETURN QUERY SELECT NULL::uuid, 0::bigint, 0::bigint;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (Mantenha a função cleanup_old_attempts se ela já existia)
CREATE OR REPLACE FUNCTION public.cleanup_old_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.attempts
  WHERE completed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


ALTER TABLE public.attempts
-- ADD COLUMN card_order uuid[], -- Ordem embaralhada das cartas
ADD COLUMN studied_cards uuid[], -- IDs das cartas já estudadas
ADD COLUMN completed BOOLEAN DEFAULT FALSE;
-- ADD COLUMN completed_at TIMESTAMP;


-- Adiciona a coluna para armazenar a ordem embaralhada dos IDs dos cartões para cada tentativa
ALTER TABLE public.attempts
ADD COLUMN card_order uuid[];

-- Comentário opcional para descrever a nova coluna
COMMENT ON COLUMN public.attempts.card_order IS 'Array ordenado dos IDs dos cartões (cards.id) para esta tentativa específica, definindo a sequência de estudo.';

-- Opcional: Adicionar um índice se houver muitas consultas filtrando por esta coluna (menos provável)
-- CREATE INDEX idx_attempts_card_order ON public.attempts USING GIN (card_order);

-- Opcional: Backfill (preenchimento) para tentativas existentes.
-- Isso pode ser complexo e talvez não seja necessário se tentativas antigas não precisam da funcionalidade.
-- Se precisar, seria algo como:
-- WITH CardOrders AS (
--   SELECT
--     a.id as attempt_id,
--     array_agg(c.id ORDER BY random()) as shuffled_order
--   FROM public.attempts a
--   JOIN public.cards c ON a.deck_id = c.deck_id
--   WHERE a.card_order IS NULL -- Preencher apenas onde está vazio
--   GROUP BY a.id
-- )
-- UPDATE public.attempts a
-- SET card_order = co.shuffled_order
-- FROM CardOrders co
-- WHERE a.id = co.attempt_id;
-- ATENÇÃO: O backfill acima define uma ordem aleatória *agora* para tentativas antigas.
-- Se a ordem original fosse importante, a lógica seria diferente e mais complexa.
-- Considere se o backfill é realmente necessário.


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


-- Função para limpar tentativas concluídas há +30 dias
CREATE OR REPLACE FUNCTION public.cleanup_old_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.attempts
  WHERE completed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE INDEX idx_cards_deck_id ON cards(deck_id);
CREATE INDEX idx_study_log_user_date ON study_log(user_id, created_at DESC);
CREATE INDEX idx_attempts_user_deck ON attempts(user_id, deck_id);



ALTER TABLE decks
  ADD CONSTRAINT decks_user_fk
  FOREIGN KEY (user_id)
  REFERENCES auth.users (id)
  ON DELETE CASCADE;

ALTER TABLE cards
  ADD CONSTRAINT cards_deck_fk
  FOREIGN KEY (deck_id)
  REFERENCES decks (id)
  ON DELETE CASCADE;



ALTER TABLE decks
  ADD CONSTRAINT decks_user_fk
  FOREIGN KEY (user_id)
  REFERENCES auth.users (id)
  ON DELETE CASCADE;

ALTER TABLE cards
  ADD CONSTRAINT cards_deck_fk
  FOREIGN KEY (deck_id)
  REFERENCES decks (id)
  ON DELETE CASCADE;



ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attempts_select_own" ON public.attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "attempts_insert_own" ON public.attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attempts_update_own" ON public.attempts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attempts_delete_own" ON public.attempts
  FOR DELETE USING (auth.uid() = user_id);

-- REPLICAR PARA:
-- attempts, attempts, attempts, attempts



-- Remove a função antiga para garantir uma substituição limpa.
DROP FUNCTION IF EXISTS get_card_statistics(uuid);

-- Recria a função com os dois parâmetros necessários: p_deck_id e p_user_id.
CREATE OR REPLACE FUNCTION get_card_statistics(p_deck_id UUID, p_user_id UUID)
RETURNS TABLE (
    card_id UUID,
    total_views BIGINT,
    correct_count BIGINT,
    accuracy NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS card_id,
        COUNT(sl.id) AS total_views,
        COUNT(sl.id) FILTER (WHERE sl.was_correct = TRUE) AS correct_count,
        CASE
            WHEN COUNT(sl.id) = 0 THEN 0
            ELSE TRUNC((COUNT(sl.id) FILTER (WHERE sl.was_correct = TRUE) * 100.0) / COUNT(sl.id), 2)
        END AS accuracy
    FROM
        cards c
    LEFT JOIN
        study_log sl ON c.id = sl.card_id AND sl.user_id = p_user_id
    WHERE
        c.deck_id = p_deck_id
    GROUP BY
        c.id
    ORDER BY
        c.created_at;
END;
$$ LANGUAGE plpgsql;



-- Remove as funções antigas para garantir uma recriação limpa.
DROP FUNCTION IF EXISTS get_study_streak(uuid);
DROP FUNCTION IF EXISTS get_study_activity(uuid, int);
DROP FUNCTION IF EXISTS get_daily_summary(uuid, date);

-- Recria a função get_study_streak com o fuso horário correto.
CREATE OR REPLACE FUNCTION get_study_streak(p_user_id UUID)
RETURNS TABLE (current_streak INT, longest_streak INT) AS $$
DECLARE
    -- Define a data de hoje com base no fuso horário de São Paulo.
    today_date DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
    RETURN QUERY
    WITH UserStreaks AS (
        SELECT
            COUNT(*) AS streak_length,
            -- Verifica se a sequência é atual considerando a data de hoje e ontem (no fuso de SP).
            MAX(CASE
                WHEN study_day >= today_date - INTERVAL '1 day' THEN 1
                ELSE 0
            END) AS is_current
        FROM (
            SELECT
                study_day,
                study_day - (ROW_NUMBER() OVER (ORDER BY study_day) * INTERVAL '1 day') AS streak_group
            FROM (
                SELECT DISTINCT (completed_at AT TIME ZONE 'America/Sao_Paulo')::date AS study_day
                FROM attempts
                WHERE user_id = p_user_id AND completed_at IS NOT NULL
            ) AS DistinctDays
        ) AS StreaksWithGroups
        GROUP BY streak_group
    )
    SELECT
        COALESCE(MAX(CASE WHEN is_current = 1 THEN streak_length ELSE 0 END), 0)::INT AS current_streak,
        COALESCE(MAX(streak_length), 0)::INT AS longest_streak
    FROM UserStreaks;
END;
$$ LANGUAGE plpgsql;

-- Recria a função get_study_activity com o fuso horário correto.
CREATE OR REPLACE FUNCTION get_study_activity(
  p_user_id UUID,
  p_year INT
)
RETURNS TABLE (
  study_date DATE,
  count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (completed_at AT TIME ZONE 'America/Sao_Paulo')::date AS study_date,
    COUNT(*)::INT AS count
  FROM
    attempts
  WHERE
    user_id = p_user_id AND
    -- Extrai o ano considerando o fuso horário de SP.
    EXTRACT(YEAR FROM (completed_at AT TIME ZONE 'America/Sao_Paulo')) = p_year AND
    completed_at IS NOT NULL
  GROUP BY
    study_date
  ORDER BY
    study_date;
END;
$$ LANGUAGE plpgsql;


-- Recria a função get_daily_summary com o fuso horário correto.
CREATE OR REPLACE FUNCTION get_daily_summary(p_user_id UUID, p_date DATE)
RETURNS TABLE (
    deck_name TEXT,
    attempt_number INT,
    correct_count BIGINT,
    incorrect_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.name as deck_name,
        a.attempt_number,
        COUNT(sl.id) FILTER (WHERE sl.was_correct = TRUE) AS correct_count,
        COUNT(sl.id) FILTER (WHERE sl.was_correct = FALSE) AS incorrect_count
    FROM
        study_log sl
    JOIN
        attempts a ON sl.attempt_id = a.id
    JOIN
        cards c ON sl.card_id = c.id
    JOIN
        decks d ON c.deck_id = d.id
    WHERE
        sl.user_id = p_user_id AND
        -- Compara a data da criação do log convertida para o fuso de SP.
        (sl.created_at AT TIME ZONE 'America/Sao_Paulo')::date = p_date
    GROUP BY
        d.id, d.name, a.id, a.attempt_number
    ORDER BY
        d.name, a.attempt_number;
END;
$$ LANGUAGE plpgsql;



-- Remove a função antiga para garantir uma substituição limpa.
DROP FUNCTION IF EXISTS get_daily_summary(uuid, date);

-- Cria a nova função que retorna os dados agrupados por tentativa.
CREATE OR REPLACE FUNCTION get_daily_summary(p_user_id UUID, p_date DATE)
RETURNS TABLE (
    deck_name TEXT,
    attempt_number INT,
    correct_count BIGINT,
    incorrect_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.name as deck_name,
        a.attempt_number,
        COUNT(sl.id) FILTER (WHERE sl.was_correct = TRUE) AS correct_count,
        COUNT(sl.id) FILTER (WHERE sl.was_correct = FALSE) AS incorrect_count
    FROM
        study_log sl
    JOIN
        attempts a ON sl.attempt_id = a.id
    JOIN
        cards c ON sl.card_id = c.id
    JOIN
        decks d ON c.deck_id = d.id
    WHERE
        sl.user_id = p_user_id AND
        DATE(sl.created_at) = p_date
    GROUP BY
        d.id, d.name, a.id, a.attempt_number
    ORDER BY
        d.name, a.attempt_number;
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION get_daily_summary(p_user_id UUID, p_date DATE)
RETURNS TABLE (
    deck_name TEXT,
    correct_count BIGINT,
    incorrect_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.name as deck_name,
        COUNT(sl.id) FILTER (WHERE sl.was_correct = TRUE) AS correct_count,
        COUNT(sl.id) FILTER (WHERE sl.was_correct = FALSE) AS incorrect_count
    FROM
        study_log sl
    JOIN
        cards c ON sl.card_id = c.id
    JOIN
        decks d ON c.deck_id = d.id
    WHERE
        sl.user_id = p_user_id AND
        DATE(sl.created_at) = p_date
    GROUP BY
        d.id, d.name
    ORDER BY
        d.name;
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION get_card_statistics(p_deck_id UUID)
RETURNS TABLE (
    card_id UUID,
    total_views BIGINT,
    correct_answers BIGINT,
    accuracy NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS card_id,
        COUNT(sl.id) AS total_views,
        COUNT(sl.id) FILTER (WHERE sl.was_correct = TRUE) AS correct_answers,
        CASE
            WHEN COUNT(sl.id) > 0 THEN
                (COUNT(sl.id) FILTER (WHERE sl.was_correct = TRUE) * 100.0 / COUNT(sl.id))
            ELSE
                0
        END::NUMERIC(5, 2) AS accuracy
    FROM
        cards c
    LEFT JOIN
        study_log sl ON c.id = sl.card_id
    WHERE
        c.deck_id = p_deck_id
    GROUP BY
        c.id;
END;
$$ LANGUAGE plpgsql;



CREATE TABLE IF NOT EXISTS public.study_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
    was_correct BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow individual user access to their own study logs"
ON public.study_log
FOR ALL
USING (auth.uid() = user_id);



-- Remove a função antiga de streak para garantir uma recriação limpa.
DROP FUNCTION IF EXISTS get_study_streak(uuid);

-- Remove a função antiga de atividade para garantir uma recriação limpa.
DROP FUNCTION IF EXISTS get_study_activity(uuid, int);

-- Script para a função get_study_streak
CREATE OR REPLACE FUNCTION get_study_streak(p_user_id UUID)
RETURNS TABLE (current_streak INT, longest_streak INT) AS $$
DECLARE
    today_date DATE := CURRENT_DATE;
BEGIN
    RETURN QUERY
    WITH UserStreaks AS (
        SELECT
            COUNT(*) AS streak_length,
            MAX(CASE
                WHEN study_day >= today_date - INTERVAL '1 day' THEN 1
                ELSE 0
            END) AS is_current
        FROM (
            SELECT
                study_day,
                study_day - (ROW_NUMBER() OVER (ORDER BY study_day) * INTERVAL '1 day') AS streak_group
            FROM (
                SELECT DISTINCT DATE(completed_at) AS study_day
                FROM attempts
                WHERE user_id = p_user_id AND completed_at IS NOT NULL
            ) AS DistinctDays
        ) AS StreaksWithGroups
        GROUP BY streak_group
    )
    SELECT
        COALESCE(MAX(CASE WHEN is_current = 1 THEN streak_length ELSE 0 END), 0)::INT AS current_streak,
        COALESCE(MAX(streak_length), 0)::INT AS longest_streak
    FROM UserStreaks;
END;
$$ LANGUAGE plpgsql;


-- Script para a função get_study_activity
CREATE OR REPLACE FUNCTION get_study_activity(
  p_user_id UUID,
  p_year INT
)
RETURNS TABLE (
  study_date DATE,
  count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(completed_at) AS study_date,
    COUNT(*)::INT AS count
  FROM
    attempts
  WHERE
    user_id = p_user_id AND
    EXTRACT(YEAR FROM completed_at) = p_year AND
    completed_at IS NOT NULL
  GROUP BY
    study_date
  ORDER BY
    study_date;
END;
$$ LANGUAGE plpgsql;



-- Drop a função se ela já existir, para garantir que estamos criando a versão mais recente.
DROP FUNCTION IF EXISTS search_cards(text, uuid);

-- Cria a função otimizada que busca cartões de forma insensível a acentos e cedilhas.
CREATE OR REPLACE FUNCTION search_cards(
  search_term TEXT,  -- O texto que você quer procurar
  p_user_id UUID     -- O ID do usuário logado para garantir a privacidade
)
-- A função retornará uma tabela com as mesmas colunas de antes.
RETURNS TABLE (
  id UUID,
  front_content TEXT,
  back_content TEXT,
  tags TEXT[],
  deck_id UUID,
  deck_name TEXT
) AS $$
BEGIN
  -- Inicia a consulta
  RETURN QUERY
  SELECT
    c.id,
    c.front_content,
    c.back_content,
    c.tags,
    c.deck_id,
    d.name as deck_name
  FROM
    cards c
  JOIN
    decks d ON c.deck_id = d.id
  WHERE
    -- A busca continua restrita ao usuário que fez a requisição
    c.user_id = p_user_id
    -- E agora a comparação utiliza a função unaccent() para ignorar acentos.
    AND (
      -- Compara a frente do cartão e o termo de busca, ambos sem acentos.
      unaccent(c.front_content) ILIKE '%' || unaccent(search_term) || '%' OR
      -- Compara o verso do cartão e o termo de busca, ambos sem acentos.
      unaccent(c.back_content) ILIKE '%' || unaccent(search_term) || '%' OR
      -- Compara as notas de teoria e o termo de busca, ambos sem acentos.
      unaccent(c.theory_notes) ILIKE '%' || unaccent(search_term) || '%' OR
      -- Compara as tags e o termo de busca, ambos sem acentos.
      unaccent(array_to_string(c.tags, ', ')) ILIKE '%' || unaccent(search_term) || '%'
    );
END;
$$ LANGUAGE plpgsql;



-- Drop a função se ela já existir, para garantir que estamos criando a versão mais recente.
DROP FUNCTION IF EXISTS search_cards(text, uuid);

-- Cria a função otimizada que busca cartões de forma insensível a acentos e cedilhas.
CREATE OR REPLACE FUNCTION search_cards(
  search_term TEXT,  -- O texto que você quer procurar
  p_user_id UUID     -- O ID do usuário logado para garantir a privacidade
)
-- A função retornará uma tabela com as mesmas colunas de antes.
RETURNS TABLE (
  id UUID,
  front_content TEXT,
  back_content TEXT,
  tags TEXT[],
  deck_id UUID,
  deck_name TEXT
) AS $$
BEGIN
  -- Inicia a consulta
  RETURN QUERY
  SELECT
    c.id,
    c.front_content,
    c.back_content,
    c.tags,
    c.deck_id,
    d.name as deck_name
  FROM
    cards c
  JOIN
    decks d ON c.deck_id = d.id
  WHERE
    -- A busca continua restrita ao usuário que fez a requisição
    c.user_id = p_user_id
    -- E agora a comparação utiliza a função unaccent() para ignorar acentos.
    AND (
      -- Compara a frente do cartão e o termo de busca, ambos sem acentos.
      unaccent(c.front_content) ILIKE '%' || unaccent(search_term) || '%' OR
      -- Compara o verso do cartão e o termo de busca, ambos sem acentos.
      unaccent(c.back_content) ILIKE '%' || unaccent(search_term) || '%' OR
      -- Compara as notas de teoria e o termo de busca, ambos sem acentos.
      unaccent(c.theory_notes) ILIKE '%' || unaccent(search_term) || '%' OR
      -- Compara as tags e o termo de busca, ambos sem acentos.
      unaccent(array_to_string(c.tags, ', ')) ILIKE '%' || unaccent(search_term) || '%'
    );
END;
$$ LANGUAGE plpgsql;



CREATE EXTENSION IF NOT EXISTS unaccent;


-- Drop a função se ela já existir, para garantir que estamos criando a versão mais recente.
DROP FUNCTION IF EXISTS search_cards(text, uuid);

-- Cria a função que busca cartões para um usuário específico com base em um termo de busca.
CREATE OR REPLACE FUNCTION search_cards(
  search_term TEXT,  -- O texto que você quer procurar
  p_user_id UUID     -- O ID do usuário logado, para garantir a privacidade dos dados
)
-- A função retornará uma tabela com as seguintes colunas:
RETURNS TABLE (
  id UUID,
  front_content TEXT,
  back_content TEXT,
  tags TEXT[],
  deck_id UUID,
  deck_name TEXT
) AS $$
BEGIN
  -- Inicia a consulta
  RETURN QUERY
  SELECT
    c.id,                 -- ID do cartão
    c.front_content,      -- Conteúdo da frente
    c.back_content,       -- Conteúdo do verso
    c.tags,               -- Tags do cartão
    c.deck_id,            -- ID do baralho ao qual o cartão pertence
    d.name as deck_name   -- Nome do baralho
  FROM
    cards c               -- Da tabela de cartões (alias 'c')
  -- Junta com a tabela de baralhos para obter o nome do baralho
  JOIN
    decks d ON c.deck_id = d.id
  WHERE
    -- A busca só retornará cartões pertencentes ao usuário que fez a requisição
    c.user_id = p_user_id
    -- E que correspondam ao termo de busca em qualquer um dos campos abaixo:
    AND (
      -- A busca não diferencia maiúsculas de minúsculas (ILIKE)
      c.front_content ILIKE '%' || search_term || '%' OR
      c.back_content ILIKE '%' || search_term || '%' OR
      c.theory_notes ILIKE '%' || search_term || '%' OR
      -- Converte o array de tags em uma única string para permitir a busca
      array_to_string(c.tags, ', ') ILIKE '%' || search_term || '%'
    );
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION public.get_deck_statistics(p_deck_id uuid, p_user_id uuid)
RETURNS TABLE(attempt_number integer, correct_count integer, incorrect_count integer, total_cards integer, completed_at timestamp with time zone)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.attempt_number,
    a.correct_count,
    a.incorrect_count,
    (SELECT COUNT(*) FROM public.cards c WHERE c.deck_id = p_deck_id)::integer AS total_cards,
    a.completed_at
  FROM
    public.attempts a
  WHERE
    a.deck_id = p_deck_id
    AND a.user_id = p_user_id
    AND a.completed_at IS NOT NULL
  ORDER BY
    a.attempt_number ASC;
END;
$$;

