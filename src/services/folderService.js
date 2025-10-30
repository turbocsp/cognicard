// src/services/folderService.js
import { supabase } from "@/supabaseClient";

const folderService = {
  /**
   * Busca todas as pastas de um usuário.
   * @param {string} userId - O ID do usuário.
   * @returns {Promise<Array>} - Uma promessa que resolve para um array de pastas.
   */
  async getUserFolders(userId) {
    if (!userId) {
      console.error("User ID is required to fetch folders.");
      return []; // Retorna array vazio se não houver userId
    }
    try {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("user_id", userId)
        .order("name", { ascending: true }); // Ordena por nome por padrão

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching user folders:", error);
      // Lança o erro para que o componente possa tratá-lo (ex: mostrar toast)
      throw new Error(`Erro ao buscar pastas: ${error.message}`);
    }
  },

  /**
   * Cria uma nova pasta.
   * @param {object} folderData - Dados da pasta { name, user_id, parent_folder_id }.
   * @returns {Promise<object>} - Uma promessa que resolve para a pasta criada.
   */
  async createFolder(folderData) {
    if (!folderData || !folderData.name || !folderData.user_id) {
       throw new Error("Dados incompletos para criar a pasta.");
    }
    try {
      const { data, error } = await supabase
        .from("folders")
        .insert([folderData]) // Insere como array
        .select() // Retorna o registro inserido
        .single(); // Espera um único registro de retorno

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error creating folder:", error);
      throw new Error(`Erro ao criar pasta: ${error.message}`);
    }
  },

  /**
   * Renomeia uma pasta.
   * @param {string} folderId - O ID da pasta.
   * @param {string} newName - O novo nome.
   * @returns {Promise<object>} - Uma promessa que resolve para a pasta atualizada.
   */
  async renameFolder(folderId, newName) {
     if (!folderId || !newName || !newName.trim()) {
       throw new Error("ID da pasta e novo nome são obrigatórios para renomear.");
    }
    try {
      const { data, error } = await supabase
        .from("folders")
        .update({ name: newName.trim() })
        .eq("id", folderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error renaming folder:", error);
      throw new Error(`Erro ao renomear pasta: ${error.message}`);
    }
  },

  /**
   * Move uma pasta para uma nova pasta pai.
   * @param {string} folderId - O ID da pasta a ser movida.
   * @param {string|null} newParentFolderId - O ID da nova pasta pai (ou null para mover para a raiz).
   * @returns {Promise<object>} - Uma promessa que resolve para a pasta atualizada.
   */
  async moveFolder(folderId, newParentFolderId) {
     if (!folderId) {
       throw new Error("ID da pasta é obrigatório para mover.");
    }
    try {
      const { data, error } = await supabase
        .from("folders")
        .update({ parent_folder_id: newParentFolderId })
        .eq("id", folderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error moving folder:", error);
      throw new Error(`Erro ao mover pasta: ${error.message}`);
    }
  },

  /**
   * Exclui uma pasta. CUIDADO: O Supabase excluirá em cascata decks e subpastas.
   * @param {string} folderId - O ID da pasta a ser excluída.
   * @returns {Promise<void>} - Uma promessa que resolve quando a exclusão é concluída.
   */
  async deleteFolder(folderId) {
     if (!folderId) {
       throw new Error("ID da pasta é obrigatório para excluir.");
    }
    try {
      const { error } = await supabase
        .from("folders")
        .delete()
        .eq("id", folderId);

      if (error) throw error;
      // Delete não retorna dados úteis por padrão, então não retornamos nada.
    } catch (error) {
      console.error("Error deleting folder:", error);
      throw new Error(`Erro ao excluir pasta: ${error.message}`);
    }
  },
};

export default folderService;
