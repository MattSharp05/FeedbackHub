// The classifier closes direct emails it judges aren't customer feedback
// (vendor pitches, newsletters) and starts their action item with this note.
// The dashboard hides those items.
export const AUTO_CLOSED_NOTE = "Not customer feedback — closed automatically.";

export const isAutoClosed = (q: { status: string; action: string }) =>
  q.status === "rejected" && q.action.startsWith(AUTO_CLOSED_NOTE);
