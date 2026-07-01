"use client";

import { useEffect, useRef } from "react";

// Inline Cal.com booking embed for a self-hosted instance. Uses Cal's official
// bootstrap snippet (namespaced) so embed.js initialises correctly, then mounts the
// shared event link, prefills the user, and round-trips our bookingId as metadata so
// the webhook can match the Cal booking back to our pending row. onBooked gives
// instant UI feedback; the webhook remains the source of truth.

/* eslint-disable @typescript-eslint/no-explicit-any */
const NS = "sasa";

export function CalEmbed({
  origin,
  calLink,
  name,
  email,
  notes,
  bookingId,
  onBooked,
}: {
  origin: string;
  calLink: string;
  name?: string;
  email?: string;
  notes?: string;
  bookingId: string;
  onBooked?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const bookedRef = useRef(onBooked);
  bookedRef.current = onBooked;

  useEffect(() => {
    if (!origin || !ref.current) return;
    const el = ref.current;
    const w = window as any;

    // Official Cal embed bootstrap, pointed at our self-hosted origin.
    (function (C: any, A: string, L: string) {
      const p = function (a: any, ar: any) {
        a.q.push(ar);
      };
      const d = C.document;
      C.Cal =
        C.Cal ||
        function () {
          const cal = C.Cal;
          const ar = arguments;
          if (!cal.loaded) {
            cal.ns = {};
            cal.q = cal.q || [];
            d.head.appendChild(d.createElement("script")).src = A;
            cal.loaded = true;
          }
          if (ar[0] === L) {
            const api: any = function () {
              p(api, arguments);
            };
            const namespace = ar[1];
            api.q = api.q || [];
            if (typeof namespace === "string") {
              cal.ns[namespace] = cal.ns[namespace] || api;
              p(cal.ns[namespace], ar);
              p(cal, ["initNamespace", namespace]);
            } else p(cal, ar);
            return;
          }
          p(cal, ar);
        };
    })(w, `${origin}/embed/embed.js`, "init");

    const Cal = w.Cal;
    Cal("init", NS, { origin });
    Cal.ns[NS]("inline", {
      elementOrSelector: el,
      calLink,
      config: {
        name: name || "",
        email: email || "",
        // Marker round-trips through Cal verbatim; the webhook parses it to match
        // this booking (Cal mangles custom metadata objects, so we use notes).
        notes: `${notes ? notes + "\n\n" : ""}[sasa:${bookingId}]`,
        theme: "light",
        layout: "month_view",
      },
    });
    Cal.ns[NS]("on", {
      action: "bookingSuccessful",
      callback: () => bookedRef.current?.(),
    });

    return () => {
      el.innerHTML = "";
    };
  }, [origin, calLink, name, email, notes, bookingId]);

  return <div ref={ref} className="min-h-[600px] w-full" />;
}
