import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Stack,
} from "@mui/material";
import { useState } from "react";

export function GeneratedLetterCard({ letter }: { letter: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(letter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function download() {
    const blob = new Blob([letter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "claim-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader
        title="Generated claim letter"
        action={
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<ContentCopyIcon />} onClick={copy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button size="small" startIcon={<DownloadIcon />} onClick={download}>
              Download
            </Button>
          </Stack>
        }
      />
      <CardContent>
        <Box
          component="pre"
          sx={{
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            fontSize: 14,
            bgcolor: (theme) =>
              theme.palette.mode === "light" ? "grey.50" : "grey.900",
            p: 2,
            borderRadius: 1,
            m: 0,
          }}
        >
          {letter}
        </Box>
      </CardContent>
    </Card>
  );
}
