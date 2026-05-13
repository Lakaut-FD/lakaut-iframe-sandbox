"use client";

import { useState } from "react";
import type { EventLog } from "@/types/lakaut";

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("es-AR", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

interface Props {
  events: EventLog[];
  onClear: () => void;
}

export function EventConsole({ events, onClear }: Props) {
  return (
    <div className="rounded border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
        <h3 className="text-sm font-semibold">Event Console ({events.length})</h3>
        <button
          onClick={onClear}
          className="text-xs text-gray-600 hover:text-gray-900"
        >
          Clear
        </button>
      </div>
      <ul className="max-h-[600px] overflow-y-auto divide-y divide-gray-100 font-mono text-xs">
        {events.length === 0 && (
          <li className="px-3 py-4 text-gray-400">No events yet.</li>
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
        <span className="text-gray-500">{formatTime(event.timestamp)}</span>
        <span className={hasPayload ? "text-indigo-700 underline-offset-2 hover:underline" : "text-gray-800"}>
          {event.type}
        </span>
        {event.via && <span className="text-gray-500">[via {event.via}]</span>}
        {event.status !== undefined && <span className="text-gray-500">[{event.status}]</span>}
        {event.corsError && <span className="text-red-600">[CORS]</span>}
      </button>
      {expanded && hasPayload && (
        <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-gray-50 p-2 text-[11px] leading-relaxed text-gray-800">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </li>
  );
}
