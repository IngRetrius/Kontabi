"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, X } from "lucide-react";

const BlobProvider = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.BlobProvider),
  { ssr: false }
);

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

interface ReportPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  pdfDocument: React.JSX.Element | null;
  fileName: string;
}

export function ReportPreviewDialog({
  open,
  onClose,
  title,
  pdfDocument,
  fileName,
}: ReportPreviewDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        className="!max-w-4xl !w-[95vw] !h-[90vh] !max-h-[90vh] flex flex-col"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between gap-4">
          <DialogTitle>{title}</DialogTitle>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-lg border bg-muted/30 overflow-hidden">
          {mounted && pdfDocument ? (
            <BlobProvider document={pdfDocument as React.ReactElement<import("@react-pdf/renderer").DocumentProps>}>
              {({ url, loading }) => {
                if (loading || !url) {
                  return (
                    <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Generando documento...</span>
                    </div>
                  );
                }
                return (
                  <iframe
                    src={url}
                    title={title}
                    className="h-full w-full"
                  />
                );
              }}
            </BlobProvider>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Sin documento
            </div>
          )}
        </div>

        <DialogFooter>
          {mounted && pdfDocument ? (
            <PDFDownloadLink document={pdfDocument as React.ReactElement<import("@react-pdf/renderer").DocumentProps>} fileName={fileName}>
              {({ loading }: { loading: boolean }) => (
                <Button disabled={loading} size="sm">
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Descargar PDF
                </Button>
              )}
            </PDFDownloadLink>
          ) : null}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
