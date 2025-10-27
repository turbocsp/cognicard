// src/services/deckService.js
import { supabase } from "@/supabaseClient";

const deckService = {
  async getDeckCards(deckId) {
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
      throw error;
    }
  },

  async getDeck(deckId) {
    try {
      const { data, error } = await supabase
        .from("decks")
        .select("*")
        .eq("id", deckId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error fetching deck:", error);
      throw error;
    }
  },
};

export default deckService;
