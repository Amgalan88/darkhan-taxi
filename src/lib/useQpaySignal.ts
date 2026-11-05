"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabasePublic } from "@/lib/supabase";

/** Demo signal so the open driver app learns that the passenger paid by QPay. */
export function useQpaySignal(rideId: string | null, onRemote: () => void) {
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!rideId) return;
    const sb = supabasePublic();
    const ch = sb.channel(`ride-pay-${rideId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channelRef.current = ch;
    ch.on("broadcast", { event: "qpay" }, () => onRemoteRef.current());
    ch.subscribe();
    return () => {
      channelRef.current = null;
      sb.removeChannel(ch);
    };
  }, [rideId]);

  return useCallback(() => {
    const ch = channelRef.current;
    const id = rideId;
    if (!ch || !id) return;
    void ch.send({ type: "broadcast", event: "qpay", payload: { rideId: id } }).catch(() => {});
  }, [rideId]);
}
