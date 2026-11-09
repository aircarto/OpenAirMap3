import React from "react";
import CommentsThread from "../CommentsThread";
import { useContextThread } from "../map/hooks/useContextThread";
import { sensorSubjectId } from "../../constants/context";

const PanelCommentsContent: React.FC<{ deviceId: string }> = ({ deviceId }) => {
  const thread = useContextThread(sensorSubjectId(deviceId));
  return (
    <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
      <CommentsThread
        comments={thread.comments}
        loading={thread.loading}
        posting={thread.posting}
        error={thread.error}
        onAdd={(text, user) => thread.addComment(text, user)}
      />
    </div>
  );
};

export default PanelCommentsContent;
