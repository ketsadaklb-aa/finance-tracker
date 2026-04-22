"use client";
import { useState } from "react";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, CheckCircle } from "lucide-react";

interface Currency { id: string; code: string; symbol: string }
interface Account { id: string; name: string; currency: Currency }

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState({ dateCol: "", amountCol: "", descCol: "", typeMode: "sign", typeCol: "" });
  const [step, setStep] = useState<"upload" | "map" | "done">("upload");
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/accounts").then(r => r.json()).then(setAccounts);
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError("");

    // Get column preview
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch("/api/import", { method: "PUT", body: fd });
    if (res.ok) {
      const data = await res.json();
      setColumns(data.columns);
      setPreview(data.preview);
      setMapping(m => ({ ...m, dateCol: data.columns[0] ?? "", amountCol: data.columns[1] ?? "", descCol: data.columns[2] ?? "" }));
    } else {
      setError("Could not parse file. Make sure it's a valid CSV.");
    }
  }

  async function handleImport() {
    if (!file || !accountId) return;
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("accountId", accountId);
    fd.append("dateCol", mapping.dateCol);
    fd.append("amountCol", mapping.amountCol);
    fd.append("descCol", mapping.descCol);
    fd.append("typeMode", mapping.typeMode);
    if (mapping.typeMode === "col") fd.append("typeCol", mapping.typeCol);

    const res = await fetch("/api/import", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult(data);
      setStep("done");
    } else {
      setError(data.error ?? "Import failed");
    }
  }

  function reset() {
    setFile(null); setAccountId(""); setColumns([]); setPreview([]);
    setMapping({ dateCol: "", amountCol: "", descCol: "", typeMode: "sign", typeCol: "" });
    setStep("upload"); setResult(null); setError("");
  }

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import Statement</h1>
        <p className="text-slate-500 text-sm mt-1">Upload a CSV bank statement and map the columns</p>
      </div>

      {step === "done" ? (
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold text-slate-900">Import Complete</h2>
            <p className="text-slate-500">{result?.imported} transactions imported successfully.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset}>Import Another</Button>
              <Button onClick={() => window.location.href = "/transactions"}>View Transactions</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Step 1: Upload */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" />Step 1: Select File & Account</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Which account is this statement for?" /></SelectTrigger>
                  <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency.code})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>CSV File</Label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
                  <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {file ? (
                      <div className="flex items-center justify-center gap-2 text-slate-700">
                        <FileText className="h-5 w-5 text-slate-400" />
                        <span className="font-medium">{file.name}</span>
                        <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
                      </div>
                    ) : (
                      <div className="text-slate-400">
                        <Upload className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">Click to upload CSV file</p>
                        <p className="text-xs mt-1">Exported from your bank's online portal</p>
                      </div>
                    )}
                  </label>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Map columns */}
          {columns.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Step 2: Map Columns</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Date Column</Label>
                    <Select value={mapping.dateCol} onValueChange={v => setMapping(m => ({ ...m, dateCol: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount Column</Label>
                    <Select value={mapping.amountCol} onValueChange={v => setMapping(m => ({ ...m, amountCol: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description Column</Label>
                    <Select value={mapping.descCol} onValueChange={v => setMapping(m => ({ ...m, descCol: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>How to detect Income vs Expense</Label>
                  <Select value={mapping.typeMode} onValueChange={v => setMapping(m => ({ ...m, typeMode: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sign">By sign — positive = income, negative = expense</SelectItem>
                      <SelectItem value="col">By column — a separate column says Credit/Debit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {mapping.typeMode === "col" && (
                  <div className="space-y-1.5">
                    <Label>Type Column</Label>
                    <Select value={mapping.typeCol} onValueChange={v => setMapping(m => ({ ...m, typeCol: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select type column..." /></SelectTrigger>
                      <SelectContent>{columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}

                {/* Preview */}
                {preview.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Preview (first 5 rows)</p>
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-slate-50 border-b border-slate-100">
                          {columns.map(c => <th key={c} className="text-left p-2 font-medium text-slate-500 whitespace-nowrap">{c}</th>)}
                        </tr></thead>
                        <tbody>
                          {preview.map((row, i) => (
                            <tr key={i} className="border-b border-slate-50">
                              {columns.map(c => <td key={c} className="p-2 text-slate-600 whitespace-nowrap">{row[c] ?? "—"}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={loading || !accountId || !mapping.dateCol || !mapping.amountCol || !mapping.descCol}
                  onClick={handleImport}
                >
                  {loading ? "Importing..." : "Import Transactions"}
                </Button>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
