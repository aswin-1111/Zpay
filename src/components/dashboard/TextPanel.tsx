import type { TextPanelConfig } from "../../types/dashboard";

export default function TextPanel({
  config,
  editable,
  onChange,
}: {
  config: TextPanelConfig;
  editable: boolean;
  onChange: (markdown: string) => void;
}) {
  if (editable) {
    return (
      <textarea
        className="text-panel-editor"
        value={config.markdown}
        placeholder="Write a note…"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className="text-panel-content">
      {config.markdown ? (
        config.markdown.split("\n").map((line, i) => <p key={i}>{line}</p>)
      ) : (
        <p className="text-panel-placeholder">Empty note</p>
      )}
    </div>
  );
}
