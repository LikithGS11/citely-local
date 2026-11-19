"use client";

import React, { useState } from "react";
import { X, User, Sliders, Palette, Check, RotateCcw, Plus, Trash2 } from "lucide-react";
import { useAuth, User as UserType } from "./AuthContext";
import { useSettings, FontSize, Density, Theme } from "./SettingsContext";
import { useToast } from "./ToastContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";

type Tab = "general" | "profile" | "preferences";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Palette },
  { id: "profile", label: "Profile", icon: User },
  { id: "preferences", label: "Preferences", icon: Sliders },
];

const DEPARTMENTS = ["HR", "Finance", "Operations", "Engineering", "Legal", "General"];
const ROLES: UserType["role"][] = ["admin", "manager", "viewer"];

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex p-0.5 rounded-lg bg-dark-bg border border-dark-border">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            value === opt.value ? "bg-accent-600 text-white" : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Row({ title, description, control }: { title: string; description: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm text-ink-primary font-medium">{title}</p>
        <p className="text-xs text-ink-muted mt-0.5">{description}</p>
      </div>
      {control}
    </div>
  );
}

export const SettingsModal: React.FC<{ initialTab?: Tab; onClose: () => void }> = ({ initialTab = "general", onClose }) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { user, profiles, switchUser, addProfile, removeProfile } = useAuth();
  const { settings, updateSettings, resetSettings } = useSettings();
  const toast = useToast();
  useEscapeToClose(true, onClose);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDepartment, setNewDepartment] = useState("General");
  const [newRole, setNewRole] = useState<UserType["role"]>("viewer");

  const resetAddForm = () => {
    setNewName("");
    setNewEmail("");
    setNewDepartment("General");
    setNewRole("viewer");
    setShowAddForm(false);
  };

  const handleAddProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    const created = addProfile({ full_name: newName.trim(), email: newEmail.trim(), department: newDepartment, role: newRole });
    switchUser(created);
    toast.success(`Profile "${created.full_name}" created`);
    resetAddForm();
  };

  const handleRemoveProfile = (profile: UserType) => {
    if (profiles.length <= 1) {
      toast.error("At least one profile must remain");
      return;
    }
    removeProfile(profile.id);
    toast.success(`Profile "${profile.full_name}" removed`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-xl h-[560px] bg-dark-card rounded-2xl border border-dark-border shadow-card flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left tab nav */}
        <div className="w-40 shrink-0 border-r border-dark-border p-3 flex flex-col">
          <h2 className="px-2 py-2 text-sm font-semibold text-ink-primary">Settings</h2>
          <div className="space-y-0.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                    active ? "bg-overlay/5 text-ink-primary font-medium" : "text-ink-secondary hover:bg-overlay/5 hover:text-ink-primary"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border shrink-0">
            <h3 className="text-sm font-semibold text-ink-primary">{TABS.find((t) => t.id === tab)?.label}</h3>
            <button onClick={onClose} className="text-ink-muted hover:text-ink-primary">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 divide-y divide-dark-border">
            {tab === "general" && (
              <>
                <Row
                  title="Theme"
                  description="Light or dark interface"
                  control={
                    <Segmented<Theme>
                      value={settings.theme}
                      onChange={(v) => updateSettings({ theme: v })}
                      options={[
                        { value: "dark", label: "Dark" },
                        { value: "light", label: "Light" },
                      ]}
                    />
                  }
                />
                <Row
                  title="Font size"
                  description="Scales text and spacing across the whole app"
                  control={
                    <Segmented<FontSize>
                      value={settings.fontSize}
                      onChange={(v) => updateSettings({ fontSize: v })}
                      options={[
                        { value: "sm", label: "Small" },
                        { value: "md", label: "Medium" },
                        { value: "lg", label: "Large" },
                      ]}
                    />
                  }
                />
                <Row
                  title="Message density"
                  description="Compact reduces spacing in the chat transcript"
                  control={
                    <Segmented<Density>
                      value={settings.density}
                      onChange={(v) => updateSettings({ density: v })}
                      options={[
                        { value: "comfortable", label: "Comfortable" },
                        { value: "compact", label: "Compact" },
                      ]}
                    />
                  }
                />
              </>
            )}

            {tab === "profile" && (
              <>
                <div className="py-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent-600 flex items-center justify-center text-white font-semibold shrink-0">
                    {user.full_name.split(" ")[0][0]}
                    {user.full_name.split(" ").length > 1 ? user.full_name.split(" ")[1][0] : ""}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-primary truncate">{user.full_name}</p>
                    <p className="text-xs text-ink-muted truncate">{user.email}</p>
                    <p className="text-xs text-ink-muted">{user.department} department</p>
                  </div>
                </div>

                <div className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Profiles</p>
                    {!showAddForm && (
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-1 text-xs font-medium text-accent-text hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add profile
                      </button>
                    )}
                  </div>

                  {showAddForm && (
                    <form onSubmit={handleAddProfile} className="space-y-2.5 p-3 rounded-lg bg-dark-bg border border-dark-border mb-3">
                      <input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Full name"
                        required
                        className="w-full px-2.5 py-1.5 rounded-lg bg-dark-card border border-dark-border text-xs text-ink-primary placeholder:text-ink-muted outline-none"
                      />
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Email"
                        required
                        className="w-full px-2.5 py-1.5 rounded-lg bg-dark-card border border-dark-border text-xs text-ink-primary placeholder:text-ink-muted outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newDepartment}
                          onChange={(e) => setNewDepartment(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg bg-dark-card border border-dark-border text-xs text-ink-secondary outline-none"
                        >
                          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as UserType["role"])}
                          className="px-2.5 py-1.5 rounded-lg bg-dark-card border border-dark-border text-xs text-ink-secondary outline-none"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="ghost" size="sm" onClick={resetAddForm}>Cancel</Button>
                        <Button type="submit" variant="primary" size="sm">Create</Button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-1">
                    {profiles.map((profile) => {
                      const isSelected = profile.id === user.id;
                      return (
                        <div
                          key={profile.id}
                          className={`group w-full px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                            isSelected ? "bg-accent-500/10 text-ink-primary" : "hover:bg-overlay/5 text-ink-secondary"
                          }`}
                        >
                          <button onClick={() => switchUser(profile)} className="text-left flex-1 min-w-0">
                            <p className="text-xs font-medium flex items-center gap-1.5 truncate">
                              {profile.full_name}
                              {isSelected && <Check className="w-3 h-3 text-accent-text shrink-0" />}
                            </p>
                            <span className="text-[11px] text-ink-muted">{profile.department}</span>
                          </button>
                          <button
                            onClick={() => handleRemoveProfile(profile)}
                            disabled={profiles.length <= 1}
                            title="Remove profile"
                            className="opacity-0 group-hover:opacity-100 disabled:opacity-0 p-1.5 rounded-md text-ink-muted hover:text-status-critical hover:bg-status-critical/10 transition-all shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {tab === "preferences" && (
              <>
                <Row
                  title="Auto-expand reasoning"
                  description="Show agent reasoning steps expanded by default"
                  control={
                    <Toggle
                      checked={settings.autoExpandReasoning}
                      onChange={(v) => updateSettings({ autoExpandReasoning: v })}
                      label="Auto-expand reasoning"
                    />
                  }
                />
                <Row
                  title="Search results"
                  description="Number of results returned by direct search"
                  control={
                    <select
                      value={settings.searchResultCount}
                      onChange={(e) => updateSettings({ searchResultCount: Number(e.target.value) })}
                      className="px-2.5 py-1.5 rounded-lg bg-dark-bg border border-dark-border text-xs text-ink-secondary outline-none"
                    >
                      {[4, 6, 8, 10].map((n) => (
                        <option key={n} value={n}>{n} results</option>
                      ))}
                    </select>
                  }
                />
                <div className="py-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                    onClick={() => {
                      resetSettings();
                      toast.success("Preferences reset to defaults");
                    }}
                  >
                    Reset to defaults
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
