// import { useEffect, useState, useCallback, useMemo } from "react";
// import api from "../api/axios";
// import FileUpload from "../components/FileUpload.jsx";
// import DocumentList from "../components/DocumentList.jsx";

// function formatStorage(bytes) {
//   const gb = bytes / (1024 * 1024 * 1024);
//   return `${gb.toFixed(1)} GB`;
// }

// export default function Dashboard() {
//   const [documents, setDocuments] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [activeSection, setActiveSection] = useState("Dashboard");

//   const fetchDocs = useCallback(async () => {
//     const { data } = await api.get("/documents");
//     setDocuments(data);
//     setLoading(false);
//   }, []);

//   useEffect(() => {
//     fetchDocs();
//   }, [fetchDocs]);

//   const totalStorageBytes = 5 * 1024 * 1024 * 1024;
//   const usedStorageBytes = useMemo(
//     () => documents.reduce((sum, doc) => sum + (doc.sizeBytes || 0), 0),
//     [documents]
//   );
//   const storagePercent = Math.min(100, Math.round((usedStorageBytes / totalStorageBytes) * 100));
//   const recentDocuments = [...documents]
//     .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
//     .slice(0, 5);

//   const handleUploadComplete = useCallback(() => {
//     fetchDocs();
//   }, [fetchDocs]);

//   const handleDocumentChange = useCallback((event) => {
//     if (event?.type === "delete") {
//       setDocuments((prev) => prev.filter((doc) => doc._id !== event.doc?._id));
//       return;
//     }

//     fetchDocs();
//   }, [fetchDocs]);

//   const renderSectionContent = () => {
//     if (activeSection === "Shared with me") {
//       return (
//         <div className="section-panel">
//           <h2>Shared with me</h2>
//           <p>Files shared by your teammates will appear here as soon as they are shared.</p>
//         </div>
//       );
//     }

//     if (activeSection === "Recent") {
//       return (
//         <div className="section-panel">
//           <h2>Recent files</h2>
//           {recentDocuments.length === 0 ? (
//             <div className="empty-state">No recent files yet.</div>
//           ) : (
//             <DocumentList documents={recentDocuments} onChange={handleDocumentChange} />
//           )}
//         </div>
//       );
//     }

//     if (activeSection === "Trash") {
//       return (
//         <div className="section-panel">
//           <h2>Trash</h2>
//           <p>Deleted files will stay here until you permanently remove them.</p>
//         </div>
//       );
//     }

//     return (
//       <>
//         <div className="section-summary">
//           <div className="summary-card">
//             <span>Files</span>
//             <strong>{documents.length}</strong>
//           </div>
//           <div className="summary-card">
//             <span>Storage used</span>
//             <strong>{formatStorage(usedStorageBytes)}</strong>
//           </div>
//         </div>

//         <FileUpload onUploaded={handleUploadComplete} />

//         {loading ? (
//           <div className="empty-state">Loading…</div>
//         ) : (
//           <DocumentList documents={documents} onChange={handleDocumentChange} />
//         )}
//       </>
//     );
//   };

//   return (
//     <div className="dashboard">
//       <div className="dashboard-shell">
//         <aside className="dashboard-sidebar">
//           <div className="sidebar-section">
//             <h3>Quick access</h3>
//             <div className="sidebar-nav">
//               {['Dashboard', 'My files', 'Shared with me', 'Recent', 'Trash'].map((item) => (
//                 <button
//                   key={item}
//                   type="button"
//                   className={`sidebar-nav-item ${activeSection === item ? "active" : ""}`}
//                   onClick={() => setActiveSection(item)}
//                 >
//                   {item}
//                 </button>
//               ))}
//             </div>
//           </div>

//           <div className="sidebar-card">
//             <div className="sidebar-card-title">Storage use</div>
//             <div className="storage-meter">
//               <div className="storage-meter-fill" style={{ width: `${storagePercent}%` }} />
//             </div>
//             <div className="storage-copy">{storagePercent}% used • {formatStorage(usedStorageBytes)} of {formatStorage(totalStorageBytes)}</div>
//           </div>
//         </aside>

//         <div className="dashboard-main">
//           <div className="dashboard-head">
//             <div>
//               <h1 className="dashboard-title">{activeSection}</h1>
//               <div className="dashboard-sub">
//                 Files are encrypted at rest and only ever accessed via short-lived, signed links.
//               </div>
//             </div>
//           </div>

//           {renderSectionContent()}
//         </div>
//       </div>
//     </div>
//   );
// }
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/axios";
import FileUpload from "../components/FileUpload.jsx";

const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024; // 5GB display quota (not enforced server-side)
const PAGE_SIZE = 7;

const TYPE_META = {
  pdf: { label: "PDF", bg: "#fdeceb", color: "#d9453d" },
  doc: { label: "DOCX", bg: "#e9eefc", color: "#3457c9" },
  docx: { label: "DOCX", bg: "#e9eefc", color: "#3457c9" },
  png: { label: "PNG", bg: "#e7f8f1", color: "#1a9b6b" },
  jpg: { label: "JPG", bg: "#e7f8f1", color: "#1a9b6b" },
  jpeg: { label: "JPG", bg: "#e7f8f1", color: "#1a9b6b" },
  txt: { label: "TXT", bg: "#f1f2f4", color: "#6b7280" },
};

function extOf(name) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function typeMeta(name) {
  return TYPE_META[extOf(name)] || { label: "FILE", bg: "#f1f2f4", color: "#6b7280" };
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

const TABS = [
  { key: "all", label: "All" },
  { key: "mine", label: "My Files" },
  { key: "shared", label: "Shared with me" },
  { key: "recent", label: "Recent" },
];

export default function Dashboard({ search, onUsageChange }) {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "all";

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchDocs = useCallback(async () => {
    const { data } = await api.get("/documents");
    setDocuments(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  useEffect(() => { setPage(1); }, [view, search]);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const scoped = useMemo(() => {
    return documents.filter((doc) => {
      if (view === "mine") return doc.isOwner;
      if (view === "shared") return !doc.isOwner;
      if (view === "recent") return new Date(doc.createdAt).getTime() >= sevenDaysAgo;
      return true;
    });
  }, [documents, view, sevenDaysAgo]);

  const filtered = useMemo(() => {
    if (!search) return scoped;
    return scoped.filter((d) => d.originalName.toLowerCase().includes(search.toLowerCase()));
  }, [scoped, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats always reflect the user's full set, independent of the active tab/search
  const stats = useMemo(() => {
    const mine = documents.filter((d) => d.isOwner);
    const usedBytes = mine.reduce((sum, d) => sum + (d.sizeBytes || 0), 0);
    const recentCount = documents.filter((d) => new Date(d.createdAt).getTime() >= sevenDaysAgo).length;
    const sharedByMeCount = mine.filter((d) => d.sharedWith?.length > 0).length;
    return {
      totalFiles: documents.length,
      usedBytes,
      recentCount,
      sharedByMeCount,
    };
  }, [documents, sevenDaysAgo]);

  useEffect(() => { onUsageChange?.(stats.usedBytes); }, [stats.usedBytes, onUsageChange]);

  const storagePercent = Math.min(
    100,
    Math.round((stats.usedBytes / STORAGE_LIMIT_BYTES) * 100)
  );

  const recentDocuments = useMemo(
    () =>
      [...documents]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5),
    [documents]
  );

  const handleUploadComplete = useCallback(() => {
    fetchDocs();
  }, [fetchDocs]);

  const download = async (doc) => {
    const { data } = await api.get(`/documents/${doc._id}/download-url`);
    window.open(data.url, "_blank", "noopener,noreferrer");
  };

  const share = async (doc) => {
    const email = window.prompt("Share with (email address):");
    if (!email) return;
    try {
      await api.post(`/documents/${doc._id}/share`, { email });
      fetchDocs();
    } catch (err) {
      alert(err.response?.data?.message || "Couldn't share that file");
    }
  };

  const remove = async (doc) => {
    if (!window.confirm(`Delete "${doc.originalName}"? This can't be undone.`)) return;
    await api.delete(`/documents/${doc._id}`);
    fetchDocs();
  };

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">Dashboard</h1>

      <div className="stat-grid">
        <StatCard icon="📁" bg="#e9eefc" color="#3457c9" label="Total Files" value={stats.totalFiles} sub="All your files" />
        <StatCard icon="💾" bg="#e7f8f1" color="#1a9b6b" label="Storage Used" value={`${(stats.usedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`} sub={`${storagePercent}% of ${(STORAGE_LIMIT_BYTES / (1024 * 1024 * 1024)).toFixed(0)} GB`} />
        <StatCard icon="🕐" bg="#fdf3e3" color="#c9861a" label="Recent Files" value={stats.recentCount} sub="Last 7 days" />
        <StatCard icon="🔗" bg="#f0ecff" color="#6f4de8" label="Shared Files" value={stats.sharedByMeCount} sub="Files shared by you" />
      </div>

      {recentDocuments.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <h2 className="panel-title">Recent Uploads</h2>
          </div>
          <div style={{ padding: "4px 20px 16px" }}>
            {recentDocuments.map((doc) => {
              const meta = typeMeta(doc.originalName);
              return (
                <div
                  key={doc._id}
                  className="file-name-cell"
                  style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}
                >
                  <div className="file-icon" style={{ background: meta.bg, color: meta.color }}>
                    {meta.label.slice(0, 3)}
                  </div>
                  <span className="file-name">{doc.originalName}</span>
                  <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>
                    {formatDate(doc.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">My Files</h2>
          <div className="tabs">
            {TABS.map((t) => (
              <a key={t.key} href={t.key === "all" ? "?" : `?view=${t.key}`}>
                <button className={`tab-btn ${view === t.key ? "active" : ""}`}>{t.label}</button>
              </a>
            ))}
          </div>
          <button className="folder-btn" onClick={() => alert("Folders aren't supported yet — coming soon!")}>
            + New Folder
          </button>
        </div>

        <FileUpload onUploaded={handleUploadComplete} />

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {search ? `No files match "${search}"` : "No documents yet. Upload your first file above."}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="file-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Type</th>
                    <th>Uploaded On</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((doc) => {
                    const meta = typeMeta(doc.originalName);
                    return (
                      <tr key={doc._id}>
                        <td>
                          <div className="file-name-cell">
                            <div className="file-icon" style={{ background: meta.bg, color: meta.color }}>
                              {meta.label.slice(0, 3)}
                            </div>
                            <span className="file-name">{doc.originalName}</span>
                          </div>
                        </td>
                        <td className="muted">{formatSize(doc.sizeBytes)}</td>
                        <td><span className="type-pill">{meta.label}</span></td>
                        <td className="muted">{formatDate(doc.createdAt)}</td>
                        <td>
                          <div className="row-actions">
                            <button className="icon-btn" title="Download" onClick={() => download(doc)}>⬇</button>
                            {doc.isOwner && (
                              <>
                                <button className="icon-btn" title="Share" onClick={() => share(doc)}>🔗</button>
                                <button className="icon-btn danger" title="Delete" onClick={() => remove(doc)}>🗑</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span>Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} files</span>
              <div className="pager-btns">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button key={n} className={n === page ? "active" : ""} onClick={() => setPage(n)}>{n}</button>
                ))}
                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, bg, color, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bg, color }}>{icon}</div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        <div className="stat-sub">{sub}</div>
      </div>
    </div>
  );
}