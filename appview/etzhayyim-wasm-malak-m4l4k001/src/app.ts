// malak.etzhayyim.com thin facade. Domain logic runs in AgentGateway MCP + pod-side LangServer workers.

interface SecretBinding {
  get(): Promise<string>;
}

interface Env {
  ASSETS?: Fetcher;
  DISPATCHER_URL?: string;
  DISPATCHER_INTERNAL_SECRET?: string | SecretBinding;
  APP_NANOID?: string;
}

interface ExportedHandler<E> {
  fetch(req: Request, env: E): Promise<Response>;
}

const ACTOR_DID = "did:web:malak.etzhayyim.com";
const NSID_PREFIX = "com.etzhayyim.apps.malak.";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/health" || url.pathname === "/healthz" || url.pathname === "/readyz" || url.pathname === "/_app/meta") {
      return json({
        ok: true,
        actor: ACTOR_DID,
        nanoid: env.APP_NANOID ?? "",
        execution: "edge-proxy+agentgateway-mcp+langserver",
        businessLogic: "40-engine/kotoba/crates/kotoba-kotodama/py/src/kotodama/primitives/malak.py",
        bpmn: "etzhayyim-root/00-contracts/bpmn/com/etzhayyim/malak",
      });
    }

    const nsid = url.pathname.startsWith("/xrpc/") ? url.pathname.slice("/xrpc/".length) : "";
    if (nsid.startsWith(NSID_PREFIX) && (req.method === "POST" || req.method === "GET")) {
      const body = await bodyWithQuery(req, url);
      if (body.__invalidJson) return json({ error: "InvalidJson" }, 400);
      const gate = preflightGate(nsid, body);
      if (gate) return json(gate.body, gate.status);
      return proxyToDispatcher(env, nsid, body);
    }

    if (env.ASSETS) return env.ASSETS.fetch(req);
    return json({ error: "NotFound", message: `${ACTOR_DID} not found` }, 404);
  },
} satisfies ExportedHandler<Env>;

// ── Edge preflight gates (surveillance capability cluster) ─────────────────
// Hard rules from `_working/malak/surveillance/COMPLIANCE-MEMO.md` §6 SAFETY_GATES.
// Defense-in-depth: these block before request leaves edge; dispatcher/BPMN
// repeat the same checks. Failing any gate here returns 4xx and does NOT proxy.

const ALLOWED_OPT_IN_SOURCES = new Set([
  "exhibition_list", "lecture_host", "referral", "inbound",
]);
const ALLOWED_BUSINESS_DAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

interface GateFailure {
  status: number;
  body: { status: string; error: string };
}

function preflightGate(nsid: string, body: Record<string, unknown>): GateFailure | null {
  switch (nsid) {
    case "com.etzhayyim.apps.malak.queryPerson":
      return gateWarrantRequired(body);
    case "com.etzhayyim.apps.malak.exportSurveillanceEvidence":
      return gateTwoStageApproval(body);
    case "com.etzhayyim.apps.malak.registerAgencyProspect":
      return gateOptInSource(body);
    case "com.etzhayyim.apps.malak.sendAgencyOutreach":
      return gateBusinessHour(body);
    default:
      return null;
  }
}

function gateWarrantRequired(body: Record<string, unknown>): GateFailure | null {
  const lb = (body as { legalBasis?: { warrantRef?: string; enquiryRef?: string } }).legalBasis ?? {};
  const hasWarrant = typeof lb.warrantRef === "string" && lb.warrantRef.length > 0;
  const hasEnquiry = typeof lb.enquiryRef === "string" && lb.enquiryRef.length > 0;
  if (!hasWarrant && !hasEnquiry) {
    return {
      status: 403,
      body: {
        status: "denied",
        error: "WARRANT_OR_ENQUIRY_REQUIRED: queryPerson is hard-gated at edge; provide legalBasis.warrantRef OR legalBasis.enquiryRef.",
      },
    };
  }
  return null;
}

function gateTwoStageApproval(body: Record<string, unknown>): GateFailure | null {
  const i = body as { supervisorDid?: string; sectionChiefDid?: string };
  if (!i.supervisorDid || !i.sectionChiefDid) {
    return {
      status: 403,
      body: {
        status: "denied",
        error: "TWO_STAGE_APPROVAL_REQUIRED: exportSurveillanceEvidence requires both supervisorDid and sectionChiefDid.",
      },
    };
  }
  return null;
}

function gateOptInSource(body: Record<string, unknown>): GateFailure | null {
  const src = (body as { optInSource?: string }).optInSource;
  if (!src || !ALLOWED_OPT_IN_SOURCES.has(src)) {
    return {
      status: 403,
      body: {
        status: "rejectedOptInSource",
        error: `optInSource must be one of [${[...ALLOWED_OPT_IN_SOURCES].join(", ")}]; got ${JSON.stringify(src)}`,
      },
    };
  }
  const at = (body as { optInAt?: string }).optInAt;
  if (!at) {
    return {
      status: 403,
      body: { status: "rejectedOptInMissing", error: "optInAt is required" },
    };
  }
  return null;
}

function gateBusinessHour(body: Record<string, unknown>): GateFailure | null {
  const hint = (body as { scheduleHint?: string }).scheduleHint;
  if (hint === "nextBusinessHour") return null;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", weekday: "short", hour: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const day = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  if (!ALLOWED_BUSINESS_DAYS.has(day) || hour < 9 || hour >= 17) {
    return {
      status: 403,
      body: {
        status: "rejectedOutsideHours",
        error: "Outside 09:00-17:00 JST weekdays; resubmit with scheduleHint=nextBusinessHour to queue.",
      },
    };
  }
  return null;
}

async function bodyWithQuery(req: Request, url: URL): Promise<Record<string, unknown>> {
  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    const text = await req.text();
    try {
      body = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch {
      return { __invalidJson: true };
    }
  }
  for (const [key, value] of url.searchParams) {
    if (!(key in body)) body[key] = value;
  }
  return body;
}

async function proxyToDispatcher(env: Env, nsid: string, body: Record<string, unknown>): Promise<Response> {
  const base = (env.DISPATCHER_URL ?? "https://dispatcher.etzhayyim.com").replace(/\/+$/, "");
  const headers: Record<string, string> = { "content-type": "application/json" };
  const trust = await internalTrustSecret(env);
  if (trust) headers["x-internal-trust"] = trust;

  const resp = await fetch(`${base}/xrpc/${nsid}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  return new Response(text, {
    status: resp.status,
    headers: {
      "content-type": resp.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}

async function internalTrustSecret(env: Env): Promise<string> {
  const binding = env.DISPATCHER_INTERNAL_SECRET;
  if (!binding) return "";
  try {
    return typeof binding === "string" ? binding : await binding.get();
  } catch {
    return "";
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
