"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, isApiError } from "@/lib/api-client";
import type { MeDTO } from "@/lib/api-types";

/** Same rule as the server (ISKELET F11); the server stays the authority (blocklist, uniqueness). */
export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;
const NICKNAME_RE = /^[A-Za-z0-9_]+$/;

export function validateNickname(v: string): string {
  if (v.length < NICKNAME_MIN) return `Too short — use at least ${NICKNAME_MIN} characters.`;
  if (v.length > NICKNAME_MAX) return `Too long — ${NICKNAME_MAX} characters max.`;
  if (!NICKNAME_RE.test(v)) return "Only letters, numbers and underscores.";
  return "";
}

type FieldState =
  { kind: "default" } | { kind: "error"; message: string } | { kind: "success"; message: string };

interface NicknameFormProps {
  initial?: string | null;
  onSaved: (me: MeDTO) => void;
  onCancel?: () => void;
}

export function NicknameForm({ initial, onSaved, onCancel }: NicknameFormProps) {
  const [value, setValue] = useState(initial ?? "");
  const [field, setField] = useState<FieldState>({ kind: "default" });
  const [saving, setSaving] = useState(false);

  function check(v: string): boolean {
    const err = validateNickname(v);
    setField(err ? { kind: "error", message: err } : { kind: "success", message: "Looks good." });
    return !err;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!check(v) || saving) return;
    setSaving(true);
    try {
      const me = await api.updateNickname(v);
      onSaved(me);
    } catch (err) {
      let message = "Couldn't save your nickname. Check your connection and try again.";
      if (isApiError(err)) {
        if (err.code === "CONFLICT") message = `“${v}” is already taken. Try another.`;
        else if (err.code === "VALIDATION") message = err.message || "That nickname isn't allowed.";
        else if (err.code === "RATE_LIMITED")
          message = "Too many attempts. Wait a moment and try again.";
      }
      setField({ kind: "error", message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="stack" data-component="NicknameForm" noValidate onSubmit={onSubmit}>
      <div className="field" data-state={field.kind}>
        <label className="field__label" htmlFor="nickname-input">
          Nickname
        </label>
        <input
          className="input"
          data-component="Input"
          id="nickname-input"
          name="nickname"
          type="text"
          maxLength={24}
          autoComplete="nickname"
          placeholder="e.g. ClutchCity_23"
          aria-describedby="nickname-msg nickname-hint"
          aria-invalid={field.kind === "error" ? true : undefined}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (e.target.value.length) check(e.target.value.trim());
            else setField({ kind: "default" });
          }}
        />
        <span className="field__hint" id="nickname-hint">
          {NICKNAME_MIN}–{NICKNAME_MAX} characters · letters, numbers and _ only
        </span>
        <span className="field__msg" id="nickname-msg" aria-live="polite">
          {field.kind !== "default" ? (
            <>
              <Icon name={field.kind === "error" ? "alert" : "check"} size="sm" />
              {field.message}
            </>
          ) : null}
        </span>
      </div>
      <div className="row">
        <Button type="submit" className="grow" loading={saving}>
          Save nickname
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** Modal + form + success toast (design overlay #nickname-modal). */
export function NicknameModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: string | null;
  onSaved: (me: MeDTO) => void;
}) {
  const toast = useToast();
  return (
    <Modal
      open={open}
      onClose={onClose}
      id="nickname-modal"
      title="Set your nickname"
      description="This is how you'll appear on the leaderboard."
    >
      <NicknameForm
        initial={initial}
        onCancel={onClose}
        onSaved={(me) => {
          toast("Nickname saved — you're on the leaderboard", "success", "check");
          onSaved(me);
          onClose();
        }}
      />
    </Modal>
  );
}
