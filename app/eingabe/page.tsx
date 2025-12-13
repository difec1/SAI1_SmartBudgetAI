'use client';

/**
 * Eingabe-Seite:
 * - Manuelle Transaktionserfassung (Form) + CSV-Upload mit KI-Klassifizierung.
 * - Upload-Statusanzeige für Bulk-Import.
 * Hinweis: Demo-Seite, im finalen Produkt ggf. ausgeblendet.
 */

import { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import TransactionForm from '@/components/TransactionForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRequireAuth } from '@/hooks/useAuth';

type BulkUploadResult = {
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  errors?: { line: number; message: string }[];
};

export default function EingabePage() {
  const { session } = useRequireAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<BulkUploadResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [manualSaved, setManualSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  if (session === undefined) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-center text-gray-600">Lade...</p>
      </div>
    );
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Input zurücksetzen, damit die gleiche Datei erneut gewählt werden kann, ohne zweimal klicken zu müssen
    event.target.value = '';

    if (!session?.access_token) return;
    setFileName(file.name);
    setUploading(true);
    setUploadSummary(null);
    setManualSaved(false);
    setUploadProgress(10);
    const progressInterval = window.setInterval(() => {
      setUploadProgress((p) => Math.min(90, p + 10));
    }, 300);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/transactions/bulk', {
        method: 'POST',
        body: formData,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      setUploadSummary(data);
      setUploadProgress(100);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadSummary({
        success: false,
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [{ line: 0, message: 'Upload fehlgeschlagen. Bitte erneut versuchen.' }],
      });
      setUploadProgress(0);
    } finally {
      window.clearInterval(progressInterval);
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 600);
    }
  };

  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Transaktionen erfassen</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Einzelne Transaktionen manuell oder mehrere per CSV hochladen und automatisch klassifizieren lassen.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TransactionForm
          variant="embedded"
          accessToken={session?.access_token || ''}
          onSuccess={() => {
            setManualSaved(true);
            setTimeout(() => setManualSaved(false), 2000);
          }}
        />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                <Upload className="w-5 h-5 text-blue-600" />
                <span>CSV Upload</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
            <div
              className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
              onClick={() => {
                if (uploading) return;
                triggerFileDialog();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex flex-col items-center justify-center space-y-2 cursor-pointer">
                <div className="p-3 rounded-full bg-blue-50">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">Datei auswählen</p>
                  <p className="text-sm text-gray-600">
                    Unterstützt CSV mit Spalten: date, merchant, amount, rawCategory?, justification?
                  </p>
                  {fileName && <p className="text-xs text-gray-500 mt-1">Ausgewählt: {fileName}</p>}
                </div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={(e) => {
                    e.stopPropagation(); // verhindert doppeltes Öffnen (Button + Container)
                    triggerFileDialog();
                  }}
                >
                  {uploading ? 'Lade hoch...' : 'CSV hochladen'}
                </Button>
              </div>
            </div>

            {uploadProgress > 0 && (
              <div className="mt-2">
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {uploadSummary && (
              <div
                className={`p-4 rounded-lg border ${
                  uploadSummary.success
                    ? 'border-green-300 bg-green-50 dark:bg-green-200/80 text-black'
                    : 'border-red-200 bg-red-50 dark:bg-red-200/80 text-black'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {uploadSummary.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <p className="font-semibold text-black">
                    {uploadSummary.success
                      ? 'Upload erfolgreich verarbeitet'
                      : 'Upload mit Fehlern'}
                  </p>
                </div>
                <p className="text-sm text-black mt-1">
                  {uploadSummary.succeeded} von {uploadSummary.processed} Zeilen gespeichert,{' '}
                  {uploadSummary.failed} fehlgeschlagen.
                </p>
                {uploadSummary.errors && uploadSummary.errors.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-gray-600 list-disc list-inside">
                    {uploadSummary.errors.slice(0, 3).map((err, idx) => (
                      <li key={idx}>Zeile {err.line}: {err.message}</li>
                    ))}
                    {uploadSummary.errors.length > 3 && (
                      <li>Weitere {uploadSummary.errors.length - 3} Fehler...</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            <div className="text-xs text-gray-500">
              Beispiel CSV:
              <pre className="mt-2 bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-[11px] overflow-x-auto">
date,merchant,amount,rawCategory,justification
2025-02-10,Coop,45.20,Lebensmittel,Wocheneinkauf
2025-02-11,Zalando,89.50,Shopping,Neue Schuhe
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {manualSaved && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          Transaktion gespeichert und klassifiziert.
        </div>
      )}
    </div>
  );
}
