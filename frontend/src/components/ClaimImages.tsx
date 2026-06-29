import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { addDocument, deleteDocument, listDocuments } from "../api/documents";
import { apiErrorMessage } from "../api/client";
import type { ClaimDocument } from "../types";

const MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

const isImage = (d: ClaimDocument) =>
  (d.fileType ?? "").startsWith("image/") ||
  (d.fileUrl ?? "").startsWith("data:image/");

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

const noContextMenu = (e: React.MouseEvent) => e.preventDefault();

/**
 * Proof images for a claim. Uploads are stored as base64 data URLs (POC) and
 * rendered directly via <img src={dataUrl}>. Clicking a thumbnail opens a
 * full-size modal with prev/next (carousel), download and delete; right-click
 * is disabled on the images.
 */
export function ClaimImages({
  claimId,
  label = "Proof images",
  hint,
}: {
  claimId: number;
  label?: string;
  hint?: string;
}) {
  const [docs, setDocs] = useState<ClaimDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function load() {
    listDocuments(claimId)
      .then(setDocs)
      .catch(() => undefined);
  }
  useEffect(load, [claimId]);

  const images = docs.filter(isImage);
  const current = previewIndex != null ? images[previewIndex] : null;

  function download(doc: ClaimDocument) {
    if (!doc.fileUrl) return;
    const a = document.createElement("a");
    a.href = doc.fileUrl;
    a.download = doc.fileName || "proof";
    a.click();
  }

  const goPrev = () =>
    setPreviewIndex((i) => (i == null ? i : (i - 1 + images.length) % images.length));
  const goNext = () =>
    setPreviewIndex((i) => (i == null ? i : (i + 1) % images.length));

  async function handleDelete() {
    if (previewIndex == null) return;
    const doc = images[previewIndex];
    if (!doc) return;
    if (!confirm("Delete this image? This can't be undone.")) return;
    try {
      await deleteDocument(claimId, doc.id);
      const remaining = images.length - 1;
      setDocs((ds) => ds.filter((d) => d.id !== doc.id));
      if (remaining <= 0) setPreviewIndex(null);
      else setPreviewIndex((i) => Math.min(i ?? 0, remaining - 1));
    } catch (err) {
      setError(apiErrorMessage(err, "Delete failed"));
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = ""; // allow re-selecting same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large (max 1.5 MB for this POC).");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await readAsDataUrl(file);
      await addDocument(claimId, {
        fileName: file.name,
        fileType: file.type,
        fileUrl: dataUrl,
      });
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="subtitle1">{label}</Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={uploading ? <CircularProgress size={16} /> : <UploadFileIcon />}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Attach screenshot"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFile}
        />
      </Stack>
      {hint && (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {images.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No images attached yet.
        </Typography>
      ) : (
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {images.map((d, i) => (
            <Box
              key={d.id}
              component="img"
              src={d.fileUrl ?? ""}
              alt={d.fileName}
              onClick={() => setPreviewIndex(i)}
              onContextMenu={noContextMenu}
              sx={{
                width: 140,
                height: 100,
                objectFit: "cover",
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                cursor: "pointer",
              }}
            />
          ))}
        </Stack>
      )}

      {/* Full-size preview modal with carousel */}
      <Dialog
        open={current != null}
        onClose={() => setPreviewIndex(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent
          sx={{ p: 0, bgcolor: "grey.900", position: "relative" }}
          onContextMenu={noContextMenu}
        >
          <Box
            component="img"
            src={current?.fileUrl ?? ""}
            alt={current?.fileName ?? ""}
            onContextMenu={noContextMenu}
            sx={{
              display: "block",
              maxWidth: "100%",
              maxHeight: "75vh",
              objectFit: "contain",
              mx: "auto",
              userSelect: "none",
              WebkitUserDrag: "none",
            }}
          />
          {images.length > 1 && (
            <>
              <IconButton
                onClick={goPrev}
                aria-label="Previous image"
                sx={{
                  position: "absolute",
                  left: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "common.white",
                  bgcolor: "rgba(0,0,0,0.45)",
                  "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                }}
              >
                <ChevronLeftIcon />
              </IconButton>
              <IconButton
                onClick={goNext}
                aria-label="Next image"
                sx={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "common.white",
                  bgcolor: "rgba(0,0,0,0.45)",
                  "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                }}
              >
                <ChevronRightIcon />
              </IconButton>
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  bottom: 8,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  color: "common.white",
                  textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                }}
              >
                {(previewIndex ?? 0) + 1} / {images.length}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Button color="error" startIcon={<DeleteIcon />} onClick={handleDelete}>
            Delete image
          </Button>
          <Box>
            <Button
              startIcon={<DownloadIcon />}
              onClick={() => current && download(current)}
              sx={{ mr: 1 }}
            >
              Download image
            </Button>
            <Button variant="contained" onClick={() => setPreviewIndex(null)}>
              Close
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
