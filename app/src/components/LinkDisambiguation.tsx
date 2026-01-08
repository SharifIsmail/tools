import { APP_ROOT_PATH } from "../config";
import { useAppActions, useAppStoreSelector } from "../state/AppContext";

export function LinkDisambiguation() {
  const resolution = useAppStoreSelector((s) => s.ui.linkResolution);
  const actions = useAppActions();

  if (!resolution) return null;

  return (
    <div className="palette__backdrop" role="presentation" onClick={() => actions.dismissLinkResolution()}>
      <div className="palette" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="palette__header">
          <div className="palette__title">Multiple matches</div>
          <div className="palette__hint">{resolution.query}</div>
        </div>
        <div className="palette__results">
          {resolution.options.map((file) => (
            <button
              key={file.id}
              className="palette__row"
              onClick={() => {
                actions.pickLinkTarget(file.id);
              }}
            >
              <span>{file.path}</span>
              {!file.path.startsWith(APP_ROOT_PATH) && <span className="palette__badge">External</span>}
            </button>
          ))}
          {resolution.options.length === 0 && <div className="palette__empty">No matching files found</div>}
        </div>
      </div>
    </div>
  );
}
