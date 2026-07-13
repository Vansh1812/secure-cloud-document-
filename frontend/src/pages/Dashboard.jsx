import { useEffect, useState, useCallback, useMemo } from "react";
import api from "../api/axios";
import FileUpload from "../components/FileUpload.jsx";
import DocumentList from "../components/DocumentList.jsx";

function formatStorage(bytes) {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("Dashboard");

  const fetchDocs = useCallback(async () => {
    const { data } = await api.get("/documents");
    setDocuments(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const totalStorageBytes = 5 * 1024 * 1024 * 1024;
  const usedStorageBytes = useMemo(
    () => documents.reduce((sum, doc) => sum + (doc.sizeBytes || 0), 0),
    [documents]
  );
  const storagePercent = Math.min(100, Math.round((usedStorageBytes / totalStorageBytes) * 100));
  const recentDocuments = [...documents]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const handleUploadComplete = useCallback(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleDocumentChange = useCallback((event) => {
    if (event?.type === "delete") {
      setDocuments((prev) => prev.filter((doc) => doc._id !== event.doc?._id));
      return;
    }

    fetchDocs();
  }, [fetchDocs]);

  const renderSectionContent = () => {
    if (activeSection === "Shared with me") {
      return (
        <div className="section-panel">
          <h2>Shared with me</h2>
          <p>Files shared by your teammates will appear here as soon as they are shared.</p>
        </div>
      );
    }

    if (activeSection === "Recent") {
      return (
        <div className="section-panel">
          <h2>Recent files</h2>
          {recentDocuments.length === 0 ? (
            <div className="empty-state">No recent files yet.</div>
          ) : (
            <DocumentList documents={recentDocuments} onChange={handleDocumentChange} />
          )}
        </div>
      );
    }

    if (activeSection === "Trash") {
      return (
        <div className="section-panel">
          <h2>Trash</h2>
          <p>Deleted files will stay here until you permanently remove them.</p>
        </div>
      );
    }

    return (
      <>
        <div className="section-summary">
          <div className="summary-card">
            <span>Files</span>
            <strong>{documents.length}</strong>
          </div>
          <div className="summary-card">
            <span>Storage used</span>
            <strong>{formatStorage(usedStorageBytes)}</strong>
          </div>
        </div>

        <FileUpload onUploaded={handleUploadComplete} />

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : (
          <DocumentList documents={documents} onChange={handleDocumentChange} />
        )}
      </>
    );
  };

  return (
    <div className="dashboard">
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="sidebar-section">
            <h3>Quick access</h3>
            <div className="sidebar-nav">
              {['Dashboard', 'My files', 'Shared with me', 'Recent', 'Trash'].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`sidebar-nav-item ${activeSection === item ? "active" : ""}`}
                  onClick={() => setActiveSection(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-card">
            <div className="sidebar-card-title">Storage use</div>
            <div className="storage-meter">
              <div className="storage-meter-fill" style={{ width: `${storagePercent}%` }} />
            </div>
            <div className="storage-copy">{storagePercent}% used • {formatStorage(usedStorageBytes)} of {formatStorage(totalStorageBytes)}</div>
          </div>
        </aside>

        <div className="dashboard-main">
          <div className="dashboard-head">
            <div>
              <h1 className="dashboard-title">{activeSection}</h1>
              <div className="dashboard-sub">
                Files are encrypted at rest and only ever accessed via short-lived, signed links.
              </div>
            </div>
          </div>

          {renderSectionContent()}
        </div>
      </div>
    </div>
  );
}
