"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, isApiError } from "@/lib/api-client";
import type { MeDTO } from "@/lib/api-types";
import type { Messages } from "@/lib/i18n/types";
import { useT } from "@/lib/i18n/provider";

/** Same rule as the server (ISKELET F11); the server stays the authority (blocklist, uniqueness). */
export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;
const NICKNAME_RE = /^[A-Za-z0-9_]+$/;

export function validateNickname(v: string, t: Messages): string {
  if (v.length < NICKNAME_MIN) return t.nickname.tooShort(NICKNAME_MIN);
  if (v.length > NICKNAME_MAX) return t.nickname.tooLong(NICKNAME_MAX);
  if (!NICKNAME_RE.test(v)) return t.nickname.chars;
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
  const t = useT();

  function check(v: string): boolean {
    const err = validateNickname(v, t);
    setField(
      err ? { kind: "error", message: err } : { kind: "success", message: t.nickname.looksGood },
    );
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
      let message = t.nickname.saveError;
      if (isApiError(err)) {
        if (err.code === "CONFLICT") message = t.nickname.taken(v);
        else if (err.code === "VALIDATION") message = t.nickname.rejected(err.message);
        else if (err.code === "RATE_LIMITED") message = t.nickname.rateLimited;
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
          {t.nickname.label}
        </label>
        <input
          className="input"
          data-component="Input"
          id="nickname-input"
          name="nickname"
          type="text"
          maxLength={24}
          autoComplete="nickname"
          placeholder={t.nickname.placeholder}
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
          {t.nickname.hint(NICKNAME_MIN, NICKNAME_MAX)}
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
          {t.nickname.save}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {t.common.cancel}
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
  const t = useT();
  return (
    <Modal
      open={open}
      onClose={onClose}
      id="nickname-modal"
      title={t.nickname.modalTitle}
      description={t.nickname.modalDesc}
    >
      <NicknameForm
        initial={initial}
        onCancel={onClose}
        onSaved={(me) => {
          toast(t.nickname.savedToast, "success", "check");
          onSaved(me);
          onClose();
        }}
      />
    </Modal>
  );
}
