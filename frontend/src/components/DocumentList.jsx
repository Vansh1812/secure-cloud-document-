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

export default function DocumentList({ documents, onChange, inTrash = false }) {
  const download = async (doc) => {
    try {
      const { data } = await api.get(`/documents/${doc._id}/download-url`);
      const res = await fetch(data.url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.originalName || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      // fallback to opening in new tab if blob download fails
      try {
        const { data } = await api.get(`/documents/${doc._id}/download-url`);
        window.open(data.url, "_blank", "noopener,noreferrer");
      } catch (e) {
        alert(err.message || "Download failed");
      }
    }
  };

  const remove = async (doc) => {
    if (inTrash) {
      if (!window.confirm(`Permanently delete "${doc.originalName}"? This can't be undone.`)) return;
      await api.delete(`/documents/${doc._id}/permanent`);
      onChange?.({ type: "delete", doc });
      return;
    }

    if (!window.confirm(`Delete "${doc.originalName}"? This will move the file to Trash.`)) return;
    await api.delete(`/documents/${doc._id}`);
    onChange?.({ type: "delete", doc, trashed: true });
  };

  const open = async (doc) => {
    try {
      const { data } = await api.get(`/documents/${doc._id}/download-url`);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(err.response?.data?.message || "Unable to open file");
    }
  };

  const restore = async (doc) => {
    if (!window.confirm(`Restore "${doc.originalName}" from Trash?`)) return;
    await api.post(`/documents/${doc._id}/restore`);
    onChange?.({ type: "restore", doc });
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
            {!inTrash && <button className="icon-btn" onClick={() => open(doc)}>Open</button>}
            <button className="icon-btn" onClick={() => download(doc)}>Download</button>
            {inTrash ? (
              <>
                <button className="icon-btn" onClick={() => restore(doc)}>Restore</button>
                <button className="icon-btn danger" onClick={() => remove(doc)}>Delete permanently</button>
              </>
            ) : (
              <button className="icon-btn danger" onClick={() => remove(doc)}>Delete</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
