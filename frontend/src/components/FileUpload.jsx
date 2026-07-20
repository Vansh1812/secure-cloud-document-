import { useRef, useState } from "react";
import api from "../api/axios";

export default function FileUpload({ onUploaded }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(null); // null = idle
  const [error, setError] = useState("");

  const uploadFile = async (file) => {
    setError("");
    setProgress(0);
    try {
      // STEP 1: ask our API for a presigned S3 URL (file bytes never hit our server)
      const { data } = await api.post("/documents/upload-url", {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      // STEP 2: PUT the file directly to S3 using that URL
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", data.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.setRequestHeader("x-amz-server-side-encryption", "AES256");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      // STEP 3: tell our API the upload succeeded so it's marked ready
      await api.patch(`/documents/${data.documentId}/confirm`);

      setProgress(null);
      onUploaded?.(file.size);
    } catch (err) {
      setProgress(null);
      setError(err.response?.data?.message || "Upload failed. Try again.");
    }
  };

  const handleFiles = (files) => {
    if (files?.[0]) uploadFile(files[0]);
  };

  return (
    <div>
      <div
        className={`dropzone ${dragActive ? "active" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {progress === null ? (
          <>
            <strong>Drop a file here</strong> or click to browse
            <div style={{ marginTop: 4 }}>PDF, Word, PNG, JPG, or TXT — up to 25MB</div>
          </>
        ) : (
          <>
            Uploading… {progress}%
            <div className="upload-progress">
              <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
