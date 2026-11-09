import { useCallback, useEffect, useState } from "react";
import { ContextComment } from "../../../types";
import { ContextService } from "../../../services/ContextService";

/**
 * Charge le fil de commentaires d'un sujet (capteur / bateau / zone) et
 * permet d'en ajouter. Sans subjectId, ne fait rien.
 */
export const useContextThread = (subjectId: string | null) => {
  const [comments, setComments] = useState<ContextComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!subjectId) {
      setComments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await new ContextService().getThread(subjectId);
      setComments(data);
    } catch (e) {
      console.error("[Context] chargement du fil échoué", e);
      setError("comments.loadError");
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const addComment = useCallback(
    async (comment: string, user: string, type?: string) => {
      if (!subjectId || !comment.trim()) return;
      setPosting(true);
      setError(null);
      try {
        await new ContextService().postComment({
          subjectId,
          comment: comment.trim(),
          user,
          type,
        });
        await load();
      } catch (e) {
        console.error("[Context] envoi du commentaire échoué", e);
        setError("comments.postError");
        throw e;
      } finally {
        setPosting(false);
      }
    },
    [subjectId, load]
  );

  return { comments, loading, posting, error, addComment, reload: load };
};
