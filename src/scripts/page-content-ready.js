// Owners settle only after their initial content OR actionable error is rendered.
// Removing the marker is one-shot: later refreshes never re-hide the whole page.
export function settlePageContent(root) {
  root?.removeAttribute("data-page-pending");
}
