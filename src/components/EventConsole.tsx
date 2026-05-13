"use client";

import { useState } from "react";
import type { EventLog } from "@/types/lakaut";

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return (
    d.toLocaleTimeString("es-AR", { hour12: false }) +
    "." +
    String(d.getMilliseconds()).padStart(3, "0")
  );
}

interface Props {
  events: EventLog[];
  onClear: () => void;
}

export function EventConsole({ events, onClear }: Props) {
  return (
    <div className="overflow-hidden rounded-md border border-zinc-200">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
          Event Console <span className="font-mono text-zinc-500">({events.length})</span>
        </h3>
        <button
          onClick={onClear}
          className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900"
        >
          Clear
        </button>
      </div>
      <ul className="max-h-[600px] divide-y divide-zinc-100 overflow-y-auto bg-white font-mono text-[11px]">
        {events.length === 0 && (
          <li className="px-3 py-6 text-center text-zinc-400">No events yet.</li>
        )}
        {events.map((event, idx) => (
          <EventItem key={idx} event={event} />
        ))}
      </ul>
    </div>
  );
}

function EventItem({ event }: { event: EventLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasPayload = event.payload !== undefined && event.payload !== null;

  return (
    <li className="px-3 py-2">
      <button
        onClick={() => hasPayload && setExpanded(!expanded)}
        className="flex w-full items-start gap-2 text-left"
      >
        <span className="text-zinc-500">{formatTime(event.timestamp)}</span>
        <span
          className={
            hasPayload
              ? "font-medium text-zinc-900 underline-offset-2 hover:underline"
              : "text-zinc-700"
          }
        >
          {event.type}
        </span>
        {event.via && <span className="text-zinc-500">[via {event.via}]</span>}
        {event.status !== undefined && <span className="text-zinc-500">[{event.status}]</span>}
        {event.corsError && <span className="text-red-600">[CORS]</span>}
      </button>
      {expanded && hasPayload && (
        <pre className="mt-1.5 whitespace-pre-wrap break-all rounded bg-zinc-50 p-2 text-[10px] leading-relaxed text-zinc-800">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </li>
  );
}
