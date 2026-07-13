import api from "../api/axios";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function extOf(name) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toUpperCase() : "FILE";
}

export default function DocumentList({ documents, onChange }) {
  const download = async (doc) => {
    const { data } = await api.get(`/documents/${doc._id}/download-url`);
    window.open(data.url, "_blank", "noopener,noreferrer");
  };

  const remove = async (doc) => {
    if (!window.confirm(`Delete "${doc.originalName}"? This can't be undone.`)) return;
    await api.delete(`/documents/${doc._id}`);
    onChange?.({ type: "delete", doc });
  };

  if (documents.length === 0) {
    return <div className="empty-state">No documents yet. Upload your first file above.</div>;
  }

  return (
    <div>
      <div className="ledger-head">
        <span>Name</span>
        <span>Size</span>
        <span>Uploaded</span>
        <span></span>
      </div>
      {documents.map((doc) => (
        <div className="ledger-row" key={doc._id}>
          <div className="doc-name">
            <div className="doc-icon">{extOf(doc.originalName).slice(0, 3)}</div>
            <span>{doc.originalName}</span>
          </div>
          <span className="doc-meta">{formatSize(doc.sizeBytes)}</span>
          <span className="doc-meta">{formatDate(doc.createdAt)}</span>
          <div className="doc-actions">
            <button className="icon-btn" onClick={() => download(doc)}>Download</button>
            <button className="icon-btn danger" onClick={() => remove(doc)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
