// src/services/deckService.js
import { supabase } from "@/supabaseClient";

const deckService = {
  /**
   * Busca todas as cartas de um deck específico.
   * @param {string} deckId - O ID do deck.
   * @returns {Promise<Array>} - Uma promessa que resolve para um array de cartas.
   */
  async getDeckCards(deckId) {
    if (!deckId) {
        console.warn("Deck ID needed to fetch cards.");
        return [];
    }
    try {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("deck_id", deckId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching deck cards:", error);
      throw new Error(`Erro ao buscar cartas do baralho: ${error.message}`);
    }
  },

  /**
   * Busca os detalhes de um deck específico.
   * @param {string} deckId - O ID do deck.
   * @returns {Promise<object|null>} - Uma promessa que resolve para o objeto do deck ou null.
   */
  async getDeck(deckId) {
     if (!deckId) {
        console.warn("Deck ID needed to fetch deck details.");
        return null;
    }
    try {
      const { data, error } = await supabase
        .from("decks")
        .select("*")
        .eq("id", deckId)
        .single(); // Usa single() pois esperamos apenas um resultado

      if (error) {
        // Trata erro "No rows found" como null em vez de erro
        if (error.code === 'PGRST116') {
            console.warn(`Deck with id ${deckId} not found.`);
            return null;
        }
        throw error; // Lança outros erros
      }
      return data;
    } catch (error) {
      console.error("Error fetching deck:", error);
      throw new Error(`Erro ao buscar detalhes do baralho: ${error.message}`);
    }
  },

  /**
   * Busca todos os decks de um usuário.
   * @param {string} userId - O ID do usuário.
   * @returns {Promise<Array>} - Uma promessa que resolve para um array de decks.
   */
  async getUserDecks(userId) {
     if (!userId) {
      console.error("User ID is required to fetch decks.");
      return [];
    }
    try {
      const { data, error } = await supabase
        .from("decks")
        .select("*")
        .eq("user_id", userId)
        .order("name", { ascending: true }); // Ordena por nome

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching user decks:", error);
      throw new Error(`Erro ao buscar baralhos: ${error.message}`);
    }
  },

  /**
   * Cria um novo deck.
   * @param {object} deckData - Dados do deck { name, user_id, folder_id }.
   * @returns {Promise<object>} - Uma promessa que resolve para o deck criado.
   */
  async createDeck(deckData) {
     if (!deckData || !deckData.name || !deckData.user_id) {
       throw new Error("Dados incompletos para criar o baralho.");
    }
    try {
      const { data, error } = await supabase
        .from("decks")
        .insert([deckData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error creating deck:", error);
      throw new Error(`Erro ao criar baralho: ${error.message}`);
    }
  },

   /**
   * Renomeia um deck.
   * @param {string} deckId - O ID do deck.
   * @param {string} newName - O novo nome.
   * @returns {Promise<object>} - Uma promessa que resolve para o deck atualizado.
   */
  async renameDeck(deckId, newName) {
     if (!deckId || !newName || !newName.trim()) {
       throw new Error("ID do baralho e novo nome são obrigatórios para renomear.");
    }
    try {
      const { data, error } = await supabase
        .from("decks")
        .update({ name: newName.trim() })
        .eq("id", deckId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error renaming deck:", error);
      throw new Error(`Erro ao renomear baralho: ${error.message}`);
    }
  },

  /**
   * Move um deck para uma nova pasta.
   * @param {string} deckId - O ID do deck a ser movido.
   * @param {string|null} newFolderId - O ID da nova pasta (ou null para mover para a raiz).
   * @returns {Promise<object>} - Uma promessa que resolve para o deck atualizado.
   */
  async moveDeck(deckId, newFolderId) {
     if (!deckId) {
       throw new Error("ID do baralho é obrigatório para mover.");
    }
    try {
      const { data, error } = await supabase
        .from("decks")
        .update({ folder_id: newFolderId })
        .eq("id", deckId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error moving deck:", error);
       throw new Error(`Erro ao mover baralho: ${error.message}`);
    }
  },

  /**
   * Exclui um deck. CUIDADO: O Supabase excluirá em cascata as cartas associadas.
   * @param {string} deckId - O ID do deck a ser excluído.
   * @returns {Promise<void>} - Uma promessa que resolve quando a exclusão é concluída.
   */
  async deleteDeck(deckId) {
     if (!deckId) {
       throw new Error("ID do baralho é obrigatório para excluir.");
    }
    try {
      const { error } = await supabase
        .from("decks")
        .delete()
        .eq("id", deckId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting deck:", error);
       throw new Error(`Erro ao excluir baralho: ${error.message}`);
    }
  },

};

export default deckService;
