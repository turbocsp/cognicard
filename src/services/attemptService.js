// src/services/attemptService.js
import { supabase } from "@/supabaseClient";

const attemptService = {
  async getActiveAttempt(deckId, userId) {
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("*")
        .eq("deck_id", deckId)
        .eq("user_id", userId)
        .eq("completed", false)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error("Error fetching active attempt:", error);
      throw error;
    }
  },

  async createAttempt(attemptData) {
    try {
      const { data, error } = await supabase
        .from("attempts")
        .insert([attemptData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error creating attempt:", error);
      throw error;
    }
  },

  async updateAttempt(attemptId, updates) {
    try {
      const { data, error } = await supabase
        .from("attempts")
        .update(updates)
        .eq("id", attemptId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error updating attempt:", error);
      throw error;
    }
  },

  async completeAttempt(attemptId) {
    return this.updateAttempt(attemptId, {
      completed: true,
      completed_at: new Date().toISOString(),
    });
  },

  async getUserAttempts(userId, deckId = null) {
    try {
      let query = supabase
        .from("attempts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (deckId) {
        query = query.eq("deck_id", deckId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching user attempts:", error);
      throw error;
    }
  },
};

export default attemptService;
