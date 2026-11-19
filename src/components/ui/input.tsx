import type { InputHTMLAttributes, Ref } from "react";

/** Bare design input (`.input`); label/hint/message wrappers live in the forms that need them. */
export function Input({
  className,
  ref,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      {...rest}
      className={["input", className ?? ""].filter(Boolean).join(" ")}
      data-component="Input"
    />
  );
}
