/**
 * PROTOTYPE, throwaway: three layouts for Composite mode, switchable via
 * `?variant=A|B|C` and the floating bar. Answers "Composite mode layout and
 * interaction" (issue #7). Everything shares one in-memory composite, so you
 * can build something in one variant and see it in the others.
 */
import { useState } from "react";
import { PrototypeSwitcher } from "../components/PrototypeSwitcher";
import { useComposite } from "./useComposite";
import * as A from "./VariantA";
import * as B from "./VariantB";
import * as C from "./VariantC";

const VARIANTS = [
  { key: "A", name: A.name },
  { key: "B", name: B.name },
  { key: "C", name: C.name },
];

export function CompositePrototype() {
  const api = useComposite();
  const [variant, setVariant] = useState(() => {
    const v = new URLSearchParams(location.search).get("variant");
    return VARIANTS.some(x => x.key === v) ? v! : "A";
  });
  const change = (key: string) => {
    const url = new URL(location.href);
    url.searchParams.set("variant", key);
    history.replaceState(null, "", url);
    setVariant(key);
  };

  return (
    <>
      {variant === "A" && <A.VariantA api={api} />}
      {variant === "B" && <B.VariantB api={api} />}
      {variant === "C" && <C.VariantC api={api} />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={change} />
    </>
  );
}
