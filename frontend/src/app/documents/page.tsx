"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  GitCompare,
  History,
  Tag,
  Clock,
  AlertCircle,
  Search,
  Plus,
  X,
  UploadCloud,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/common/AuthContext";
import { useToast } from "@/components/common/ToastContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { VersionDiffModal, VersionDiffData } from "@/components/documents/VersionDiffModal";

export interface DocumentVersion {
  id: number;
  document_id: number;
  version_number: number;
  file_name: string;
  file_size_bytes: number;
  file_type: string;
  content_summary?: string;
  status: string;
  upload_date: string;
}

export interface DocumentItem {
  id: number;
  title: string;
  department: string;
  owner_id: number;
  confidentiality_level: string;
  tags: string;
  current_version_number: number;
  status: string;
  created_at: string;
  updated_at: string;
  versions: DocumentVersion[];
}

const DEPARTMENTS = ["HR", "Finance", "Operations", "Engineering", "Legal", "General"];
const CONFIDENTIALITY = ["Public", "Internal", "Confidential", "Restricted"];

const confTone = (level: string) => {
  switch (level) {
    case "Restricted": return "critical" as const;
    case "Confidential": return "warning" as const;
    case "Public": return "good" as const;
    default: return "neutral" as const;
  }
};

const IN_PROGRESS = ["PENDING", "PROCESSING"];
const isInProgress = (d: DocumentItem) =>
  IN_PROGRESS.includes(d.status) || d.versions.some((v) => IN_PROGRESS.includes(v.status));
const readyVersions = (d: DocumentItem) => d.versions.filter((v) => v.status === "READY");

const statusTone = (status: string) => {
  switch (status) {
    case "READY": return "good" as const;
    case "PROCESSING": return "warning" as const;
    case "FAILED": return "critical" as const;
    default: return "neutral" as const;
  }
};

export default function DocumentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState(user.department || "General");
  const [confidentiality, setConfidentiality] = useState("Internal");
  const [tags, setTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [targetUpdateDocId, setTargetUpdateDocId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [diffData, setDiffData] = useState<VersionDiffData | null>(null);
  const [activeHistoryDocId, setActiveHistoryDocId] = useState<number | null>(null);

  const [deptFilter, setDeptFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDocuments = async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE}/documents/`);
      if (res.ok) {
        setDocuments(await res.json());
      } else {
        throw new Error(`Server responded with ${res.status}`);
      }
    } catch (err) {
      console.error(err);
      if (!silent) setDocuments([]);
      setLoadError("Could not reach the backend server. Make sure the API is running at http://localhost:8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  // While anything is still being ingested, refresh quietly so status badges update
  const anyInProgress = documents.some(isInProgress);
  useEffect(() => {
    if (!anyInProgress) return;
    const id = setInterval(() => fetchDocuments(true), 3000);
    return () => clearInterval(id);
  }, [anyInProgress]);

  const applyFile = (file: File) => {
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title);
      formData.append("department", department);
      formData.append("confidentiality_level", confidentiality);
      formData.append("tags", tags);
      if (targetUpdateDocId) formData.append("document_id", targetUpdateDocId.toString());

      const res = await fetch(`${API_BASE}/documents/upload`, { method: "POST", body: formData });

      if (res.ok) {
        await fetchDocuments();
        setShowUploadModal(false);
        resetForm();
        toast.success(
          targetUpdateDocId
            ? "New version uploaded. The current version stays searchable until it finishes processing."
            : "Document uploaded. Processing has started."
        );
      } else {
        const detail = await res.json().catch(() => null);
        toast.error(`Upload failed: ${detail?.detail || `server responded with ${res.status}`}`);
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Upload failed: could not reach the backend server at http://localhost:8000.");
    } finally {
      setUploading(false);
    }
  };

  const handleCompareVersions = async (doc: DocumentItem) => {
    const ready = readyVersions(doc);
    if (ready.length < 2) return;
    const v1 = ready[1].version_number;
    const v2 = ready[0].version_number;
    try {
      const res = await fetch(`${API_BASE}/documents/${doc.id}/compare-versions?v1=${v1}&v2=${v2}`);
      if (res.ok) {
        setDiffData(await res.json());
        return;
      }
      const body = await res.json().catch(() => null);
      toast.error(`Version comparison failed: ${body?.detail || `server responded with ${res.status}`}`);
      return;
    } catch (err) {
      console.error("Version comparison error:", err);
      toast.error("Version comparison failed: could not reach the backend server.");
    }
  };

  const resetForm = () => {
    setTitle("");
    setSelectedFile(null);
    setTags("");
    setTargetUpdateDocId(null);
    setIsDragOver(false);
  };

  useEscapeToClose(showUploadModal, () => setShowUploadModal(false));

  const filteredDocs = documents.filter((d) => {
    if (deptFilter && d.department !== deptFilter) return false;
    if (searchQuery && !d.title.toLowerCase().includes(searchQuery.toLowerCase()) && !d.tags.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2.5 min-w-[220px]">
          <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-dark-card border border-dark-border focus-within:border-accent-500/50">
            <Search className="w-4 h-4 text-ink-muted shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents…"
              className="bg-transparent border-none outline-none text-sm text-ink-primary placeholder:text-ink-muted w-full"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-dark-card border border-dark-border text-sm text-ink-secondary outline-none"
          >
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => { resetForm(); setShowUploadModal(true); }}
        >
          Upload document
        </Button>
      </div>

      {loadError && (
        <div className="p-3.5 rounded-xl bg-status-critical/10 border border-status-critical/25 text-status-critical text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {loadError}
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="p-16 text-center text-ink-muted text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading documents…
        </div>
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents found"
          description={documents.length === 0 ? "Upload your first document to get started." : "Try a different search or filter."}
        />
      ) : (
        <div className="rounded-2xl border border-dark-border bg-dark-card divide-y divide-dark-border overflow-hidden">
          {filteredDocs.map((doc) => {
            const isHistoryOpen = activeHistoryDocId === doc.id;
            return (
              <div key={doc.id} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-overlay/5 flex items-center justify-center text-ink-secondary font-medium text-[11px] shrink-0">
                      {doc.versions?.[0]?.file_type.toUpperCase() || "DOC"}
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-ink-primary truncate">{doc.title}</h3>
                        <Badge tone={confTone(doc.confidentiality_level)}>{doc.confidentiality_level}</Badge>
                        <Badge tone={statusTone(doc.status)}>{doc.status}</Badge>
                        {doc.status === "READY" && doc.versions.some((v) => IN_PROGRESS.includes(v.status)) && (
                          <Badge tone="warning">New version processing</Badge>
                        )}
                      </div>
                      {doc.status === "FAILED" && doc.versions[0]?.content_summary && (
                        <p className="text-xs text-status-critical">{doc.versions[0].content_summary}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-ink-muted flex-wrap">
                        <span>{doc.department}</span>
                        <span>v{doc.current_version_number}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(doc.updated_at).toLocaleDateString()}
                        </span>
                        {doc.tags && (
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {doc.tags}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap self-end lg:self-center shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setTargetUpdateDocId(doc.id);
                        setTitle(doc.title);
                        setDepartment(doc.department);
                        setConfidentiality(doc.confidentiality_level);
                        setTags(doc.tags);
                        setShowUploadModal(true);
                      }}
                    >
                      New version
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<History className="w-3.5 h-3.5" />}
                      onClick={() => setActiveHistoryDocId(isHistoryOpen ? null : doc.id)}
                    >
                      History ({doc.versions.length})
                    </Button>
                    {readyVersions(doc).length >= 2 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<GitCompare className="w-3.5 h-3.5" />}
                        onClick={() => handleCompareVersions(doc)}
                      >
                        Compare
                      </Button>
                    )}
                  </div>
                </div>

                {isHistoryOpen && (
                  <div className="mt-3 pt-3 border-t border-dark-border space-y-2 pl-0 lg:pl-[52px]">
                    {doc.versions.map((ver) => (
                      <div key={ver.id} className="space-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-ink-muted shrink-0">v{ver.version_number}</span>
                          <span className="text-ink-primary font-medium truncate">{ver.file_name}</span>
                          <span className="text-ink-muted shrink-0">({Math.round(ver.file_size_bytes / 1024)} KB)</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {ver.version_number === doc.current_version_number && ver.status === "READY" && (
                            <Badge tone="good">Serving</Badge>
                          )}
                          {ver.status !== "READY" && <Badge tone={statusTone(ver.status)}>{ver.status}</Badge>}
                          <span className="text-ink-muted">{new Date(ver.upload_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {ver.status === "FAILED" && ver.content_summary && (
                        <p className="text-status-critical text-xs">{ver.content_summary}</p>
                      )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setShowUploadModal(false)}>
          <div className="w-full max-w-lg bg-dark-card rounded-2xl p-5 border border-dark-border shadow-card space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-ink-primary">
                {targetUpdateDocId ? "Upload new version" : "Upload document"}
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-ink-muted hover:text-ink-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-sm">
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files?.[0]) applyFile(e.dataTransfer.files[0]);
                }}
                className={`p-6 rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors ${
                  isDragOver ? "border-accent-500 bg-accent-500/5" : "border-dark-border hover:border-overlay/20"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.md,.markdown,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && applyFile(e.target.files[0])}
                />
                <UploadCloud className="w-6 h-6 text-ink-muted mx-auto mb-2" />
                {selectedFile ? (
                  <p className="text-ink-primary font-medium text-xs">
                    {selectedFile.name} <span className="text-ink-muted font-normal">({Math.round(selectedFile.size / 1024)} KB)</span>
                  </p>
                ) : (
                  <p className="text-ink-muted text-xs">
                    Drag a file here, or <span className="text-accent-text">browse</span>
                    <br />PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, PNG, or JPG
                  </p>
                )}
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1.5 text-xs">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Supplier ABC Master Agreement"
                  className="w-full p-2.5 rounded-lg bg-dark-bg border border-dark-border text-ink-primary text-sm outline-none focus:border-accent-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-secondary mb-1.5 text-xs">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-dark-bg border border-dark-border text-ink-primary text-sm outline-none"
                  >
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-ink-secondary mb-1.5 text-xs">Confidentiality</label>
                  <select
                    value={confidentiality}
                    onChange={(e) => setConfidentiality(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-dark-bg border border-dark-border text-ink-primary text-sm outline-none"
                  >
                    {CONFIDENTIALITY.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1.5 text-xs">Tags</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. policy, benefits, hr"
                  className="w-full p-2.5 rounded-lg bg-dark-bg border border-dark-border text-ink-primary text-sm outline-none focus:border-accent-500/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setShowUploadModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={uploading || !selectedFile}>
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {diffData && <VersionDiffModal data={diffData} onClose={() => setDiffData(null)} />}
    </div>
  );
}
