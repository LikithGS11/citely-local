"use client";

import React, { useState, useEffect } from "react";
import { 
  Upload, 
  FileText, 
  GitCompare, 
  History, 
  Shield, 
  Tag, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search,
  Filter,
  Plus,
  X
} from "lucide-react";
import { useAuth } from "@/components/common/AuthContext";
import { API_BASE } from "@/lib/api";
import { VersionDiffModal, VersionDiffData } from "@/components/documents/VersionDiffModal";

export interface DocumentVersion {
  id: number;
  document_id: number;
  version_number: number;
  file_name: string;
  file_size_bytes: number;
  file_type: string;
  content_summary?: string;
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

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Upload modal & form states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState(user.department || "General");
  const [confidentiality, setConfidentiality] = useState("Internal");
  const [tags, setTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [targetUpdateDocId, setTargetUpdateDocId] = useState<number | null>(null);

  // Version diff states
  const [diffData, setDiffData] = useState<VersionDiffData | null>(null);
  const [activeHistoryDocId, setActiveHistoryDocId] = useState<number | null>(null);

  // Filters
  const [deptFilter, setDeptFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDocuments = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE}/documents/`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      } else {
        throw new Error(`Server responded with ${res.status}`);
      }
    } catch (err) {
      console.error(err);
      setDocuments([]);
      setLoadError("Could not reach the backend server. Make sure the API is running at http://localhost:8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
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
      if (targetUpdateDocId) {
        formData.append("document_id", targetUpdateDocId.toString());
      }

      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await fetchDocuments();
        setShowUploadModal(false);
        _resetForm();
      } else {
        const detail = await res.json().catch(() => null);
        alert(`Upload failed: ${detail?.detail || `server responded with ${res.status}`}`);
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed: could not reach the backend server at http://localhost:8000.");
    } finally {
      setUploading(false);
    }
  };

  const handleCompareVersions = async (doc: DocumentItem) => {
    if (doc.versions.length < 2) {
      alert("At least 2 versions are needed to perform a side-by-side semantic diff comparison.");
      return;
    }
    const v1 = doc.versions[1].version_number;
    const v2 = doc.versions[0].version_number;

    try {
      const res = await fetch(`${API_BASE}/documents/${doc.id}/compare-versions?v1=${v1}&v2=${v2}`);
      if (res.ok) {
        const data = await res.json();
        setDiffData(data);
      } else {
        throw new Error("Failed diff");
      }
    } catch (err) {
      console.error("Version comparison error:", err);
      alert("Version comparison failed: could not reach the backend server.");
    }
  };

  const _resetForm = () => {
    setTitle("");
    setSelectedFile(null);
    setTags("");
    setTargetUpdateDocId(null);
  };

  const getConfColor = (level: string) => {
    switch (level) {
      case "Restricted": return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "Confidential": return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "Public": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      default: return "bg-blue-500/20 text-blue-300 border-blue-500/40";
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (deptFilter && d.department !== deptFilter) return false;
    if (searchQuery && !d.title.toLowerCase().includes(searchQuery.toLowerCase()) && !d.tags.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl glass-panel border border-dark-border">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            Knowledge Library & Version Control
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-enterprise-500/20 text-enterprise-300 border border-enterprise-500/30">
              {filteredDocs.length} Documents
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Ingest PDFs, DOCX, XLSX, and Images with automatic OCR, semantic chunking, and RBAC department boundaries.
          </p>
        </div>

        <button
          onClick={() => {
            _resetForm();
            setShowUploadModal(true);
          }}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-enterprise-600 to-purple-600 hover:from-enterprise-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-glow-blue transition-all shrink-0 self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          Upload Document / Version
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px] flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel border border-dark-border focus-within:border-enterprise-500/50">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, department, or tags..."
            className="bg-transparent border-none outline-none text-xs text-white placeholder:text-gray-500 w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-dark-card border border-dark-border text-xs text-gray-200 outline-none font-medium"
          >
            <option value="">All Departments</option>
            <option value="HR">HR Department</option>
            <option value="Finance">Finance Department</option>
            <option value="Operations">Operations Department</option>
            <option value="Engineering">Engineering Department</option>
            <option value="Legal">Legal Department</option>
            <option value="General">General / All</option>
          </select>
        </div>
      </div>

      {/* Backend error banner */}
      {loadError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {loadError}
        </div>
      )}

      {/* Documents Grid / Table */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 font-mono text-xs">Loading enterprise knowledge base...</div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-2xl border border-dark-border space-y-3">
          <FileText className="w-8 h-8 text-gray-500 mx-auto" />
          <p className="text-sm font-bold text-gray-300">No documents found matching your clearance or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDocs.map((doc) => {
            const isHistoryOpen = activeHistoryDocId === doc.id;
            return (
              <div
                key={doc.id}
                className="glass-panel rounded-2xl border border-dark-border hover:border-enterprise-500/40 transition-all p-5 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-dark-card border border-dark-border flex items-center justify-center text-enterprise-400 font-bold text-sm shrink-0">
                      {doc.versions && doc.versions.length > 0 ? doc.versions[0].file_type.toUpperCase() : "DOC"}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base font-extrabold text-white truncate">{doc.title}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${getConfColor(doc.confidentiality_level)}`}>
                          {doc.confidentiality_level}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-dark-bg text-gray-300 border border-dark-border font-semibold">
                          {doc.department} Dept
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-enterprise-500/20 text-enterprise-300 font-mono">
                          v{doc.current_version_number}.0
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Updated: {new Date(doc.updated_at).toLocaleDateString()}
                        </span>
                        {doc.tags && (
                          <span className="flex items-center gap-1 text-enterprise-400/80">
                            <Tag className="w-3.5 h-3.5" />
                            {doc.tags}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold ml-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {doc.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={() => {
                        setTargetUpdateDocId(doc.id);
                        setTitle(doc.title);
                        setDepartment(doc.department);
                        setConfidentiality(doc.confidentiality_level);
                        setTags(doc.tags);
                        setShowUploadModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-dark-card hover:bg-dark-accent border border-dark-border text-xs font-semibold text-gray-200 hover:text-white flex items-center gap-1.5 transition-all"
                      title="Upload new version v(N+1)"
                    >
                      <Plus className="w-3.5 h-3.5 text-enterprise-400" />
                      New Version
                    </button>

                    <button
                      onClick={() => setActiveHistoryDocId(isHistoryOpen ? null : doc.id)}
                      className="px-3.5 py-2 rounded-xl bg-dark-card hover:bg-dark-accent border border-dark-border text-xs font-semibold text-gray-200 hover:text-white flex items-center gap-1.5 transition-all"
                    >
                      <History className="w-3.5 h-3.5 text-purple-400" />
                      Changelog ({doc.versions.length})
                    </button>

                    {doc.versions.length >= 2 && (
                      <button
                        onClick={() => handleCompareVersions(doc)}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600/30 to-enterprise-600/30 hover:from-purple-600/50 hover:to-enterprise-600/50 border border-purple-500/40 text-xs font-bold text-purple-200 flex items-center gap-1.5 transition-all"
                      >
                        <GitCompare className="w-3.5 h-3.5" />
                        Compare Diff
                      </button>
                    )}
                  </div>
                </div>

                {/* Version History Drawer */}
                {isHistoryOpen && (
                  <div className="pt-4 border-t border-dark-border space-y-3 pl-4 sm:pl-16">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Version Audit Trail & Embeddings Index History:
                    </p>
                    <div className="space-y-2">
                      {doc.versions.map((ver) => (
                        <div
                          key={ver.id}
                          className="p-3 rounded-xl bg-dark-bg/80 border border-dark-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 rounded bg-enterprise-500/20 text-enterprise-300 font-bold">
                              v{ver.version_number}.0
                            </span>
                            <span className="text-white font-semibold">{ver.file_name}</span>
                            <span className="text-gray-500">({Math.round(ver.file_size_bytes / 1024)} KB)</span>
                          </div>
                          <div className="text-gray-400 text-[11px] flex items-center gap-4">
                            <span className="truncate max-w-sm italic text-gray-400">
                              "{ver.content_summary || 'Indexed vector chunks inside pgvector.'}"
                            </span>
                            <span className="text-gray-500 shrink-0">{new Date(ver.upload_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/80 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border border-dark-border shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <h3 className="font-extrabold text-lg text-white">
                {targetUpdateDocId ? "Upload New Document Version" : "Ingest New Document"}
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block font-bold text-gray-300 mb-1">Select File (PDF, DOCX, XLSX, Images OCR)</label>
                <input
                  type="file"
                  required={!targetUpdateDocId}
                  onChange={handleFileChange}
                  className="w-full p-2.5 rounded-xl bg-dark-bg border border-dark-border text-gray-300"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-300 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Supplier ABC Master Agreement 2026"
                  className="w-full p-2.5 rounded-xl bg-dark-bg border border-dark-border text-white outline-none focus:border-enterprise-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-300 mb-1">Department Scope</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-dark-bg border border-dark-border text-white outline-none"
                  >
                    <option value="HR">HR Department</option>
                    <option value="Finance">Finance Department</option>
                    <option value="Operations">Operations Department</option>
                    <option value="Engineering">Engineering Department</option>
                    <option value="Legal">Legal Department</option>
                    <option value="General">General / All</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-300 mb-1">Confidentiality Level</label>
                  <select
                    value={confidentiality}
                    onChange={(e) => setConfidentiality(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-dark-bg border border-dark-border text-white outline-none"
                  >
                    <option value="Public">Public</option>
                    <option value="Internal">Internal</option>
                    <option value="Confidential">Confidential</option>
                    <option value="Restricted">Restricted</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-300 mb-1">Tags (Comma separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. policy, benefits, hr, maternity"
                  className="w-full p-2.5 rounded-xl bg-dark-bg border border-dark-border text-white outline-none focus:border-enterprise-500"
                />
              </div>

              <div className="pt-3 border-t border-dark-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl bg-dark-card hover:bg-dark-accent text-gray-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-enterprise-600 to-purple-600 text-white font-bold disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? "Ingesting & Indexing..." : "Start Async Ingestion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diff Comparison Modal */}
      {diffData && (
        <VersionDiffModal data={diffData} onClose={() => setDiffData(null)} />
      )}
    </div>
  );
}

