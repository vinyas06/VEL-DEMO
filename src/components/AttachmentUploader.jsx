import { Camera, FileImage, Paperclip, X } from "lucide-react";
import "../pages/AddDriver.css";

const formatSize = (size = 0) => {
  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

function AttachmentUploader({
  files = [],
  onFilesChange,
  label = "Upload Image / Proof",
  hint = "Take a photo or choose an image/PDF from your phone.",
  accept = "image/*,application/pdf",
  multiple = true,
}) {
  const addFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length > 0) {
      onFilesChange(multiple ? [...files, ...selected] : selected.slice(0, 1));
    }
    event.target.value = "";
  };

  const removeFile = (indexToRemove) => {
    onFilesChange(files.filter((_, index) => index !== indexToRemove));
  };

  const cameraInputId = `${label.replace(/\s+/g, "-").toLowerCase()}-camera`;
  const fileInputId = `${label.replace(/\s+/g, "-").toLowerCase()}-file`;

  return (
    <div className="attachment-uploader full-width">
      <div className="attachment-title">
        <Paperclip size={18} />
        <div>
          <strong>{label}</strong>
          <span>{hint}</span>
        </div>
      </div>

      <div className="attachment-actions">
        <label className="attachment-btn" htmlFor={cameraInputId}>
          <Camera size={18} /> Take Photo
        </label>
        <input
          id={cameraInputId}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={multiple}
          onChange={addFiles}
        />

        <label className="attachment-btn secondary" htmlFor={fileInputId}>
          <FileImage size={18} /> Choose File
        </label>
        <input
          id={fileInputId}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={addFiles}
        />
      </div>

      {files.length > 0 && (
        <div className="attachment-list">
          {files.map((file, index) => (
            <div className="attachment-chip" key={`${file.name}-${file.size}-${index}`}>
              <span>{file.name}</span>
              <small>{formatSize(file.size)}</small>
              <button type="button" onClick={() => removeFile(index)} title="Remove attachment">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AttachmentUploader;
